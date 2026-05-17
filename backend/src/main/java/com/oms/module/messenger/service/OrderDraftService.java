package com.oms.module.messenger.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.config.MessengerProperties;
import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.common.exception.ResourceNotFoundException;
import com.oms.module.messenger.dto.CreateOrderDraftResponse;
import com.oms.module.messenger.dto.OrderInfoExtractedDto;
import com.oms.module.messenger.entity.Conversation;
import com.oms.module.messenger.entity.Message;
import com.oms.module.messenger.entity.OrderDraft;
import com.oms.module.messenger.entity.OrderDraftItem;
import com.oms.module.messenger.enums.MessageSenderType;
import com.oms.module.messenger.enums.OrderDraftStatus;
import com.oms.module.messenger.repository.OrderDraftRepository;
import com.oms.module.order.entity.Order;
import com.oms.module.product.entity.Product;
import com.oms.module.product.entity.ProductType;
import com.oms.module.product.entity.ProductVariant;
import com.oms.module.product.repository.ProductRepository;
import com.oms.module.product.repository.ProductVariantRepository;
import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.repository.ShopRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderDraftService {

    private static final int MAX_CONTEXT_MESSAGES = 200;
    public static final EnumSet<OrderDraftStatus> ACTIVE_DRAFT_STATUSES = EnumSet.of(
            OrderDraftStatus.WAITING_CONFIRM,
            OrderDraftStatus.PENDING_CUSTOMER_CONFIRMATION,
            OrderDraftStatus.NEED_MORE_INFO
    );
    public static final EnumSet<OrderDraftStatus> CONFIRMABLE_DRAFT_STATUSES = EnumSet.of(
            OrderDraftStatus.WAITING_CONFIRM,
            OrderDraftStatus.PENDING_CUSTOMER_CONFIRMATION
    );

    private final OrderDraftRepository orderDraftRepository;
    private final ConversationService conversationService;
    private final MessageService messageService;
    private final OrderExtractionService orderExtractionService;
    private final MessengerSendService messengerSendService;
    private final MessengerDtoMapper mapper;
    private final ObjectMapper objectMapper;
    private final MessengerProperties messengerProperties;
    private final ShopRepository shopRepository;
    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;

    @Transactional
    public CreateOrderDraftResponse createOrderDraftFromConversation(Long conversationId) {
        return createOrderDraftFromConversation(conversationId, null);
    }

    @Transactional
    public CreateOrderDraftResponse createOrderDraftFromConversation(Long conversationId, Long shopId) {
        Conversation conversation = conversationService.getById(conversationId);
        List<Message> contextMessages = messageService.getDraftContextMessages(conversation, MAX_CONTEXT_MESSAGES);
        OrderInfoExtractedDto extracted = orderExtractionService.extractOrderInfo(contextMessages, shopId);
        Shop shop = shopId == null ? null : shopRepository.findById(shopId).orElse(null);

        OrderDraft saved = saveDraftWithCode(buildDraft(conversation, null, shop, null, extracted));
        conversationService.updateLastOrderMarkerTime(conversation, LocalDateTime.now());
        boolean messengerSent = messengerSendService.sendSystemMessage(
                conversation.getPageId(),
                conversation.getSenderId(),
                saved.getConfirmMessage()
        ).isSent();

        log.info("Created Messenger order draft: draftId={}, conversationId={}, contextMessageCount={}",
                saved.getId(), conversationId, contextMessages.size());

        return CreateOrderDraftResponse.builder()
                .orderDraft(mapper.toOrderDraftResponse(saved))
                .confirmMessage(saved.getConfirmMessage())
                .messengerSent(messengerSent)
                .build();
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public Optional<CreateOrderDraftResponse> createOrderDraftFromSellerMessage(
            Conversation conversation,
            Message sourceMessage,
            Shop shop
    ) {
        if (sourceMessage == null || !StringUtils.hasText(sourceMessage.getText())) {
            return Optional.empty();
        }

        if (StringUtils.hasText(sourceMessage.getMid())) {
            Optional<OrderDraft> existingDraft = orderDraftRepository.findBySourceMessageMid(sourceMessage.getMid());
            if (existingDraft.isPresent()) {
                return Optional.of(CreateOrderDraftResponse.builder()
                        .orderDraft(mapper.toOrderDraftResponse(existingDraft.get()))
                        .confirmMessage(existingDraft.get().getConfirmMessage())
                        .messengerSent(false)
                        .build());
            }
        }

        Long parserShopId = shop != null ? shop.getId() : null;
        List<Message> contextMessages = getContextMessagesIncludingSource(conversation, sourceMessage);
        OrderInfoExtractedDto contextExtracted = orderExtractionService.extractOrderInfo(
                contextMessages,
                parserShopId
        );
        OrderInfoExtractedDto sourceExtracted = orderExtractionService.extractOrderInfo(
                List.of(sourceMessage),
                parserShopId
        );
        OrderInfoExtractedDto extracted = mergeSellerSourceProduct(contextExtracted, sourceExtracted);
        OrderDraft saved = saveDraftWithCode(buildDraft(conversation, sourceMessage, shop, sourceMessage.getText(), extracted));
        conversationService.updateLastOrderMarkerTime(conversation, LocalDateTime.now());

        boolean messengerSent = messengerSendService.sendSystemMessage(
                conversation.getPageId(),
                conversation.getSenderId(),
                saved.getConfirmMessage()
        ).isSent();

        log.info("Created Messenger order draft from seller echo: draftId={}, conversationId={}, sourceMid={}, status={}",
                saved.getId(), conversation.getId(), sourceMessage.getMid(), saved.getStatus());

        return Optional.of(CreateOrderDraftResponse.builder()
                .orderDraft(mapper.toOrderDraftResponse(saved))
                .confirmMessage(saved.getConfirmMessage())
                .messengerSent(messengerSent)
                .build());
    }

    private List<Message> getContextMessagesIncludingSource(Conversation conversation, Message sourceMessage) {
        List<Message> contextMessages = new ArrayList<>(
                messageService.getDraftContextMessages(conversation, MAX_CONTEXT_MESSAGES)
        );

        boolean containsSource = contextMessages.stream().anyMatch(message ->
                Objects.equals(message.getId(), sourceMessage.getId())
                        || (StringUtils.hasText(message.getMid())
                        && Objects.equals(message.getMid(), sourceMessage.getMid()))
        );
        if (!containsSource) {
            contextMessages.add(sourceMessage);
        }
        return contextMessages;
    }

    private OrderInfoExtractedDto mergeSellerSourceProduct(
            OrderInfoExtractedDto contextExtracted,
            OrderInfoExtractedDto sourceExtracted
    ) {
        OrderInfoExtractedDto context = contextExtracted == null
                ? OrderInfoExtractedDto.builder().build()
                : contextExtracted;
        OrderInfoExtractedDto source = sourceExtracted == null
                ? OrderInfoExtractedDto.builder().build()
                : sourceExtracted;
        Order.OrderType resolvedOrderType = firstNonNull(source.getOrderType(), context.getOrderType());
        boolean rentOrder = resolvedOrderType == Order.OrderType.RENT;

        return OrderInfoExtractedDto.builder()
                .customerName(firstNonBlank(context.getCustomerName(), source.getCustomerName()))
                .phone(firstNonBlank(context.getPhone(), source.getPhone()))
                .address(firstNonBlank(context.getAddress(), source.getAddress()))
                .orderType(resolvedOrderType)
                .productId(firstNonNull(source.getProductId(), context.getProductId()))
                .variantId(firstNonNull(source.getVariantId(), context.getVariantId()))
                .productName(firstNonBlank(source.getProductName(), context.getProductName()))
                .productCode(firstNonBlank(source.getProductCode(), context.getProductCode()))
                .sku(firstNonBlank(source.getSku(), context.getSku()))
                .quantity(firstNonNull(source.getQuantity(), context.getQuantity()))
                .color(firstNonBlank(source.getColor(), context.getColor()))
                .size(firstNonBlank(source.getSize(), context.getSize()))
                .price(firstNonNull(source.getPrice(), context.getPrice()))
                .depositAmount(rentOrder ? firstNonNull(source.getDepositAmount(), context.getDepositAmount()) : null)
                .rentalDays(rentOrder ? firstNonNull(source.getRentalDays(), context.getRentalDays()) : null)
                .deliveryDate(rentOrder ? firstNonNull(source.getDeliveryDate(), context.getDeliveryDate()) : null)
                .rentFrom(rentOrder ? firstNonNull(source.getRentFrom(), context.getRentFrom()) : null)
                .rentTo(rentOrder ? firstNonNull(source.getRentTo(), context.getRentTo()) : null)
                .note(firstNonBlank(context.getNote(), source.getNote()))
                .confidence(firstNonNull(source.getConfidence(), context.getConfidence()))
                .missingFields(context.getMissingFields() != null ? context.getMissingFields() : source.getMissingFields())
                .items(source.getItems() != null && !source.getItems().isEmpty()
                        ? source.getItems()
                        : context.getItems())
                .build();
    }

    @Transactional(readOnly = true)
    public Optional<OrderDraft> findLatestWaitingConfirm(Long conversationId) {
        return orderDraftRepository.findTopByConversationIdAndStatusInOrderByCreatedAtDesc(
                conversationId,
                CONFIRMABLE_DRAFT_STATUSES
        );
    }

    @Transactional(readOnly = true)
    public Optional<OrderDraft> findLatestActiveDraft(Long conversationId) {
        return orderDraftRepository.findTopByConversationIdAndStatusInOrderByCreatedAtDesc(
                conversationId,
                ACTIVE_DRAFT_STATUSES
        );
    }

    @Transactional
    public Optional<OrderDraft> applyCustomerUpdate(Conversation conversation, String updateContent) {
        return applyCustomerUpdate(conversation, updateContent, null);
    }

    @Transactional
    public Optional<OrderDraft> applyCustomerUpdate(Conversation conversation, String updateContent, Long shopId) {
        Optional<OrderDraft> optionalDraft = findLatestActiveDraft(conversation.getId());
        if (optionalDraft.isEmpty()) {
            log.info("Customer update ignored because no active draft exists. conversationId={}", conversation.getId());
            return Optional.empty();
        }

        OrderDraft draft = optionalDraft.get();
        if (draft.getStatus() != OrderDraftStatus.NEED_MORE_INFO
                && draft.getStatus() != OrderDraftStatus.PENDING_CUSTOMER_CONFIRMATION
                && draft.getStatus() != OrderDraftStatus.DRAFT) {
            log.info("Customer update ignored because draft status is not editable. conversationId={}, draftId={}, status={}",
                    conversation.getId(), draft.getId(), draft.getStatus());
            return Optional.of(draft);
        }

        String normalizedUpdate = StringUtils.hasText(updateContent) ? updateContent.trim() : "";
        Long parserShopId = shopId != null ? shopId : draft.getShop() != null ? draft.getShop().getId() : null;
        OrderInfoExtractedDto extracted = orderExtractionService.extractOrderInfo(
                List.of(Message.builder()
                        .conversation(conversation)
                        .senderType(MessageSenderType.CUSTOMER)
                        .senderId(conversation.getSenderId())
                        .text(normalizedUpdate)
                        .messageTime(LocalDateTime.now())
                        .build()),
                parserShopId
        );
        applyExtractedUpdate(draft, extracted);

        String updateNote = "Customer update: " + normalizedUpdate;
        draft.setNote(appendNote(draft.getNote(), updateNote));
        refreshAmounts(draft);
        refreshDraftStatusAndMessage(draft);

        OrderDraft saved = orderDraftRepository.save(draft);
        messengerSendService.sendSystemMessage(conversation.getPageId(), conversation.getSenderId(), saved.getConfirmMessage());

        log.info("Updated Messenger order draft from customer message: draftId={}, conversationId={}",
                saved.getId(), conversation.getId());
        return Optional.of(saved);
    }

    @Transactional(readOnly = true)
    public Page<OrderDraft> getOrderDrafts(Pageable pageable) {
        return orderDraftRepository.findAll(pageable);
    }

    @Transactional(readOnly = true)
    public OrderDraft getById(Long draftId) {
        return orderDraftRepository.findById(draftId)
                .orElseThrow(() -> new ResourceNotFoundException("OrderDraft", draftId));
    }

    @Transactional
    public OrderDraft cancel(Long draftId) {
        OrderDraft draft = getById(draftId);
        if (draft.getStatus() == OrderDraftStatus.CONFIRMED
                || draft.getStatus() == OrderDraftStatus.CONVERTED_TO_ORDER) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Cannot cancel a confirmed order draft");
        }

        draft.setStatus(OrderDraftStatus.CANCELLED);
        OrderDraft saved = orderDraftRepository.save(draft);
        log.info("Cancelled Messenger order draft: draftId={}", draftId);
        return saved;
    }

    public String buildConfirmMessage(OrderDraft draft) {
        List<String> blockingMissing = findBlockingMissingFields(draft);
        if (!blockingMissing.isEmpty()) {
            return buildMissingInfoMessage(blockingMissing);
        }

        List<String> lines = new ArrayList<>();
        lines.add("Shop đã tạo đơn tạm cho bạn:");
        lines.add("");
        lines.add("Mã đơn tạm: " + valueOrPlaceholder(draft.getDraftCode()));
        lines.add("Sản phẩm: " + valueOrPlaceholder(draft.getProductName()) + buildVariantText(draft));
        lines.add("Loại đơn: " + valueOrPlaceholder(draft.getOrderType()));
        if (draft.getOrderType() == Order.OrderType.RENT) {
            lines.add("Thoi gian thue: " + buildRentalPeriodText(draft));
            lines.add("Tien coc: " + valueOrPlaceholder(draft.getDepositAmount()));
        }
        lines.add("Tổng tiền: " + valueOrPlaceholder(draft.getTotalAmount()));
        lines.add("Địa chỉ giao hàng: " + valueOrPlaceholder(draft.getAddress()));
        lines.add("Số điện thoại: " + valueOrPlaceholder(draft.getPhone()));
        lines.add("");
        lines.add("Vui lòng nhắn \"Xác nhận đơn\" để hoàn tất đơn hàng.");
        if (draft.getStatus() == OrderDraftStatus.NEED_MORE_INFO) {
            lines.add("");
            lines.add("Đơn tạm đang thiếu thông tin. Vui lòng bổ sung các mục còn thiếu ở trên trước khi xác nhận.");
        } else {
            lines.add("");
            lines.add("Vui lòng nhắn \"Xác nhận đơn\" để hoàn tất đơn hàng.");
            lines.add("Nếu cần chỉnh sửa, bạn có thể nhắn: \"Sửa địa chỉ...\", \"Sửa SDT...\", hoặc \"Hủy đơn\".");
        }
        return String.join("\n", lines);
    }

    public List<String> findBlockingMissingFields(OrderDraft draft) {
        List<String> missingFields = new ArrayList<>();
        if (!StringUtils.hasText(draft.getCustomerName())) {
            missingFields.add("customerName");
        }
        if (!StringUtils.hasText(draft.getCustomerName())) {
            missingFields.add("customerName");
        }
        if (!StringUtils.hasText(draft.getProductName())) {
            missingFields.add("productName");
        }
        if (draft.getShop() != null && !hasResolvedVariant(draft)) {
            missingFields.add("variantId");
        }
        if (draft.getQuantity() == null) {
            missingFields.add("quantity");
        }
        if (!StringUtils.hasText(draft.getPhone())) {
            missingFields.add("phone");
        }
        if (!StringUtils.hasText(draft.getAddress())) {
            missingFields.add("address");
        }
        if (draft.getOrderType() == null) {
            missingFields.add("orderType");
        }
        if (draft.getOrderType() == Order.OrderType.RENT) {
            if (draft.getRentalDays() == null && (draft.getRentFrom() == null || draft.getRentTo() == null)) {
                missingFields.add("rentalDays");
            }
            if (draft.getRentFrom() == null || draft.getRentTo() == null) {
                missingFields.add("rentDates");
            }
        }
        return missingFields;
    }

    public boolean isExpired(OrderDraft draft) {
        return draft.getExpiresAt() != null && draft.getExpiresAt().isBefore(LocalDateTime.now());
    }

    private OrderDraft buildDraft(
            Conversation conversation,
            Message sourceMessage,
            Shop shop,
            String rawSellerMessage,
            OrderInfoExtractedDto extracted
    ) {
        OrderInfoExtractedDto safeExtracted = extracted == null ? OrderInfoExtractedDto.builder().build() : extracted;
        ResolvedDraftProduct resolvedProduct = shop != null ? resolveDraftProduct(shop, safeExtracted) : null;
        ProductVariant resolvedVariant = resolvedProduct != null ? resolvedProduct.variant() : null;
        Product product = resolvedProduct != null ? resolvedProduct.product() : null;
        String resolvedSku = firstNonBlank(safeExtracted.getSku(), resolvedVariant != null ? resolvedVariant.getSku() : null);
        BigDecimal resolvedPrice = resolveDraftPrice(safeExtracted, resolvedVariant);
        BigDecimal resolvedDeposit = resolveDraftDeposit(safeExtracted, resolvedVariant);
        OrderDraft draft = OrderDraft.builder()
                .shop(shop)
                .conversation(conversation)
                .pageId(conversation.getPageId())
                .customerPsid(conversation.getSenderId())
                .sourceMessageMid(sourceMessage != null ? sourceMessage.getMid() : null)
                .rawSellerMessage(rawSellerMessage)
                .aiParsedJson(toJson(safeExtracted))
                .customerName(safeExtracted.getCustomerName())
                .phone(safeExtracted.getPhone())
                .address(safeExtracted.getAddress())
                .orderType(safeExtracted.getOrderType())
                .productName(product != null ? product.getName() : safeExtracted.getProductName())
                .productCode(safeExtracted.getProductCode())
                .quantity(safeExtracted.getQuantity())
                .color(resolvedVariant != null ? resolvedVariant.getColor() : safeExtracted.getColor())
                .size(resolvedVariant != null ? resolvedVariant.getSize() : safeExtracted.getSize())
                .price(resolvedPrice)
                .depositAmount(resolvedDeposit)
                .rentalDays(safeExtracted.getRentalDays())
                .deliveryDate(safeExtracted.getDeliveryDate())
                .rentFrom(safeExtracted.getRentFrom())
                .rentTo(safeExtracted.getRentTo())
                .confidence(safeExtracted.getConfidence())
                .note(safeExtracted.getNote())
                .missingFields(safeExtracted.getMissingFields() != null ? safeExtracted.getMissingFields() : new ArrayList<>())
                .expiresAt(LocalDateTime.now().plusHours(Math.max(1, messengerProperties.getDraftTtlHours())))
                .build();

        applyExtractedItems(draft, safeExtracted.getItems(), shop, product, resolvedVariant, resolvedSku);
        addPrimaryItem(draft, product, resolvedVariant, resolvedSku);
        refreshAmounts(draft);
        refreshDraftStatusAndMessage(draft);
        return draft;
    }

    private OrderDraft saveDraftWithCode(OrderDraft draft) {
        OrderDraft saved = orderDraftRepository.save(draft);
        if (!StringUtils.hasText(saved.getDraftCode())) {
            saved.setDraftCode("DRAFT-" + String.format("%06d", saved.getId()));
            saved.setConfirmMessage(buildConfirmMessage(saved));
            saved = orderDraftRepository.save(saved);
        }
        return saved;
    }

    private ResolvedDraftProduct resolveDraftProduct(Shop shop, OrderInfoExtractedDto extracted) {
        int quantity = resolveDraftQuantity(extracted.getQuantity());
        Long shopId = shop.getId();
        ProductVariant variant = null;

        if (extracted.getVariantId() != null) {
            variant = productVariantRepository.findByIdAndProductShopId(extracted.getVariantId(), shopId)
                    .orElseThrow(() -> validationException("Variant ID không hợp lệ hoặc không thuộc shop hiện tại."));
        } else if (StringUtils.hasText(extracted.getSku())) {
            variant = productVariantRepository.findFirstBySkuIgnoreCaseAndProductShopIdAndIsActiveTrue(
                            extracted.getSku().trim(),
                            shopId
                    )
                    .orElseThrow(() -> validationException("SKU không hợp lệ hoặc không thuộc shop hiện tại."));
        } else if (extracted.getProductId() != null) {
            Product product = productRepository.findByIdAndShopId(extracted.getProductId(), shopId)
                    .orElseThrow(() -> validationException("Product ID không hợp lệ hoặc không thuộc shop hiện tại."));
            variant = resolveVariantFromProduct(product, extracted.getSize(), extracted.getColor());
        } else if (StringUtils.hasText(extracted.getProductCode())) {
            variant = resolveVariantByProductCode(shopId, extracted);
        } else {
            variant = resolveVariantByProductName(shopId, extracted);
        }

        validateResolvedVariant(shopId, variant, extracted.getOrderType(), quantity);
        return new ResolvedDraftProduct(variant.getProduct(), variant);
    }

    private ProductVariant resolveVariantByProductCode(Long shopId, OrderInfoExtractedDto extracted) {
        String productCode = extracted.getProductCode().trim();
        Optional<ProductVariant> variantBySku = productVariantRepository
                .findFirstBySkuIgnoreCaseAndProductShopIdAndIsActiveTrue(productCode, shopId);
        if (variantBySku.isPresent()) {
            return variantBySku.get();
        }

        List<Product> products = productRepository.findActiveProductsByCustomAttributeValue(shopId, productCode);
        if (products.isEmpty()) {
            throw validationException("Mã sản phẩm không hợp lệ hoặc không thuộc shop hiện tại.");
        }
        if (products.size() > 1) {
            throw validationException("Mã sản phẩm bị trùng. Vui lòng gửi Variant ID hoặc SKU.");
        }

        return resolveVariantFromProduct(products.get(0), extracted.getSize(), extracted.getColor());
    }

    private ProductVariant resolveVariantByProductName(Long shopId, OrderInfoExtractedDto extracted) {
        if (!StringUtils.hasText(extracted.getProductName())) {
            throw validationException("Không xác định được sản phẩm. Vui lòng gửi Variant ID hoặc SKU.");
        }

        String normalizedName = normalizeLookup(extracted.getProductName());
        List<ProductVariant> exactMatches = productRepository.findAllByShopIdAndIsActiveTrue(shopId).stream()
                .filter(product -> normalizeLookup(product.getName()).equals(normalizedName))
                .flatMap(product -> product.getVariants().stream())
                .filter(variant -> matchesActiveVariant(variant, extracted.getSize(), extracted.getColor()))
                .toList();

        if (exactMatches.size() == 1) {
            return exactMatches.get(0);
        }
        if (exactMatches.size() > 1) {
            throw validationException("Thông tin sản phẩm/size/màu chưa đủ duy nhất. Vui lòng gửi Variant ID hoặc SKU.");
        }

        List<ProductVariant> fuzzyMatches = productRepository.findAllByShopIdAndIsActiveTrue(shopId).stream()
                .filter(product -> normalizeLookup(product.getName()).contains(normalizedName)
                        || normalizedName.contains(normalizeLookup(product.getName())))
                .flatMap(product -> product.getVariants().stream())
                .filter(variant -> matchesActiveVariant(variant, extracted.getSize(), extracted.getColor()))
                .toList();

        if (fuzzyMatches.size() == 1) {
            return fuzzyMatches.get(0);
        }
        if (fuzzyMatches.isEmpty()) {
            throw validationException("Không tìm thấy biến thể phù hợp với tên sản phẩm, size và màu.");
        }
        throw validationException("Tìm thấy nhiều biến thể phù hợp. Vui lòng gửi Variant ID hoặc SKU.");
    }

    private ProductVariant resolveVariantFromProduct(Product product, String size, String color) {
        List<ProductVariant> matches = product.getVariants().stream()
                .filter(variant -> matchesActiveVariant(variant, size, color))
                .toList();

        if (matches.size() == 1) {
            return matches.get(0);
        }

        if (matches.isEmpty()) {
            throw validationException("Sản phẩm không có biến thể đang hoạt động phù hợp với size/màu đã gửi.");
        }

        throw validationException("Sản phẩm có nhiều biến thể. Vui lòng gửi Variant ID hoặc SKU.");
    }

    private boolean matchesActiveVariant(ProductVariant variant, String size, String color) {
        if (variant == null || !Boolean.TRUE.equals(variant.getIsActive())) {
            return false;
        }
        if (StringUtils.hasText(size) && !normalizeLookup(variant.getSize()).equals(normalizeLookup(size))) {
            return false;
        }
        if (StringUtils.hasText(color) && !normalizeLookup(variant.getColor()).equals(normalizeLookup(color))) {
            return false;
        }
        return true;
    }

    private void validateResolvedVariant(
            Long shopId,
            ProductVariant variant,
            Order.OrderType orderType,
            int quantity
    ) {
        if (variant == null || variant.getProduct() == null) {
            throw validationException("Không xác định được biến thể sản phẩm.");
        }

        Product product = variant.getProduct();
        if (!Boolean.TRUE.equals(variant.getIsActive())
                || !Boolean.TRUE.equals(product.getIsActive())
                || product.getShop() == null
                || !product.getShop().getId().equals(shopId)) {
            throw validationException("Bien the khong ton tai, khong active hoac khong thuoc shop hien tai.");
        }

        if (orderType != null && !supportsOrderType(product.getProductType(), orderType)) {
            throw validationException(orderType == Order.OrderType.RENT
                    ? "Bien the nay khong ho tro don thue."
                    : "Bien the nay khong ho tro don ban.");
        }

        BigDecimal price = orderType == Order.OrderType.RENT ? variant.getPriceRentPerDay() : variant.getPriceSell();
        if (orderType != null && (price == null || price.compareTo(BigDecimal.ZERO) <= 0)) {
            throw validationException(orderType == Order.OrderType.RENT
                    ? "Bien the nay chua co gia thue hop le."
                    : "Bien the nay chua co gia ban hop le.");
        }

        int stockQty = variant.getStockQty() != null ? variant.getStockQty() : 0;
        if (stockQty < quantity) {
            throw validationException("Bien the chi con " + Math.max(stockQty, 0) + ", khong du so luong " + quantity + ".");
        }
    }

    private boolean supportsOrderType(ProductType productType, Order.OrderType orderType) {
        if (productType == null || orderType == null) {
            return false;
        }
        return switch (orderType) {
            case SELL -> productType == ProductType.SELL || productType == ProductType.SELL_RENT;
            case RENT -> productType == ProductType.RENT || productType == ProductType.SELL_RENT;
        };
    }

    private int resolveDraftQuantity(Integer quantity) {
        if (quantity == null || quantity <= 0) {
            throw validationException("So luong phai lon hon 0.");
        }
        return quantity;
    }

    private BigDecimal resolveDraftPrice(OrderInfoExtractedDto extracted, ProductVariant variant) {
        if (variant == null || extracted.getOrderType() == null) {
            return extracted.getPrice();
        }

        BigDecimal extractedPrice = extracted.getPrice();
        if (extractedPrice != null && extractedPrice.compareTo(BigDecimal.ZERO) > 0) {
            return extractedPrice;
        }

        return extracted.getOrderType() == Order.OrderType.RENT
                ? variant.getPriceRentPerDay()
                : variant.getPriceSell();
    }

    private BigDecimal resolveDraftDeposit(OrderInfoExtractedDto extracted, ProductVariant variant) {
        if (extracted.getOrderType() != Order.OrderType.RENT) {
            return null;
        }

        if (extracted.getDepositAmount() != null) {
            return extracted.getDepositAmount();
        }

        if (variant == null) {
            return extracted.getDepositAmount();
        }

        return variant.getDepositAmount();
    }

    private BigDecimal resolveVariantPrice(Order.OrderType orderType, ProductVariant variant) {
        if (variant == null || orderType == null) {
            return null;
        }
        return orderType == Order.OrderType.RENT ? variant.getPriceRentPerDay() : variant.getPriceSell();
    }

    private BigDecimal resolveVariantDeposit(Order.OrderType orderType, ProductVariant variant) {
        if (variant == null || orderType != Order.OrderType.RENT) {
            return null;
        }
        return variant.getDepositAmount();
    }

    private BusinessException validationException(String message) {
        return new BusinessException(ErrorCode.VALIDATION_ERROR, message);
    }

    private void refreshDraftStatusAndMessage(OrderDraft draft) {
        List<String> blockingMissing = findBlockingMissingFields(draft);
        draft.setMissingFields(new ArrayList<>(blockingMissing));
        boolean readyForConfirmation = blockingMissing.isEmpty();
        draft.setStatus(readyForConfirmation
                ? OrderDraftStatus.PENDING_CUSTOMER_CONFIRMATION
                : OrderDraftStatus.NEED_MORE_INFO);
        draft.setConfirmMessage(buildConfirmMessage(draft));
    }

    public boolean canReceiveCustomerUpdates(OrderDraft draft) {
        return draft != null && (draft.getStatus() == OrderDraftStatus.DRAFT
                || draft.getStatus() == OrderDraftStatus.NEED_MORE_INFO
                || draft.getStatus() == OrderDraftStatus.PENDING_CUSTOMER_CONFIRMATION);
    }

    public boolean isWaitingForCustomerConfirmation(OrderDraft draft) {
        return draft != null && draft.getStatus() == OrderDraftStatus.PENDING_CUSTOMER_CONFIRMATION;
    }

    private void addPrimaryItem(OrderDraft draft) {
        addPrimaryItem(draft, null, null, null);
    }

    private void addPrimaryItem(OrderDraft draft, Product product, ProductVariant variant, String sku) {
        if (!StringUtils.hasText(draft.getProductName())) {
            return;
        }

        if (draft.getItems() == null) {
            draft.setItems(new ArrayList<>());
        }

        if (!draft.getItems().isEmpty()) {
            OrderDraftItem item = draft.getItems().get(0);
            if (product != null) {
                item.setProduct(product);
            }
            if (variant != null) {
                item.setProductVariant(variant);
            }
            if (StringUtils.hasText(sku)) {
                item.setSku(sku);
            }
            item.setProductName(draft.getProductName());
            item.setProductCode(draft.getProductCode());
            item.setVariant(buildVariantText(draft).trim());
            item.setQuantity(draft.getQuantity() != null ? draft.getQuantity() : 1);
            item.setRentalDays(draft.getOrderType() == Order.OrderType.RENT ? draft.getRentalDays() : null);
            item.setPrice(draft.getPrice());
            item.setDeposit(draft.getOrderType() == Order.OrderType.RENT ? draft.getDepositAmount() : null);
            return;
        }

        draft.addItem(OrderDraftItem.builder()
                .product(product)
                .productVariant(variant)
                .productName(draft.getProductName())
                .productCode(draft.getProductCode())
                .sku(sku)
                .variant(buildVariantText(draft).trim())
                .quantity(draft.getQuantity() != null ? draft.getQuantity() : 1)
                .rentalDays(draft.getOrderType() == Order.OrderType.RENT ? draft.getRentalDays() : null)
                .price(draft.getPrice())
                .deposit(draft.getOrderType() == Order.OrderType.RENT ? draft.getDepositAmount() : null)
                .build());
    }

    private void applyExtractedItems(
            OrderDraft draft,
            List<OrderInfoExtractedDto.ItemDto> items,
            Shop shop,
            Product product,
            ProductVariant variant,
            String sku
    ) {
        if (items == null || items.isEmpty()) {
            return;
        }
        if (draft.getItems() == null) {
            draft.setItems(new ArrayList<>());
        }
        draft.getItems().clear();
        for (OrderInfoExtractedDto.ItemDto item : items) {
            if (item == null || !StringUtils.hasText(item.getProductName())) {
                continue;
            }
            ResolvedDraftProduct resolvedItem = resolveDraftItemProduct(shop, draft, item, product, variant);
            Product itemProduct = resolvedItem != null ? resolvedItem.product() : product;
            ProductVariant itemVariant = resolvedItem != null ? resolvedItem.variant() : variant;
            String itemSku = firstNonBlank(item.getSku(), itemVariant != null ? itemVariant.getSku() : null, sku);
            draft.addItem(OrderDraftItem.builder()
                    .product(itemProduct)
                    .productVariant(itemVariant)
                    .productName(itemProduct != null ? itemProduct.getName() : item.getProductName())
                    .productCode(item.getProductCode())
                    .sku(itemSku)
                    .variant(firstNonBlank(item.getVariant(), buildItemVariantText(
                            itemVariant != null ? itemVariant.getSize() : item.getSize(),
                            itemVariant != null ? itemVariant.getColor() : item.getColor()
                    )))
                    .quantity(item.getQuantity() != null ? item.getQuantity() : 1)
                    .rentalDays(item.getRentalDays())
                    .price(item.getPrice() != null ? item.getPrice() : resolveVariantPrice(draft.getOrderType(), itemVariant))
                    .deposit(item.getDeposit() != null ? item.getDeposit() : resolveVariantDeposit(draft.getOrderType(), itemVariant))
                    .build());
        }
    }

    private ResolvedDraftProduct resolveDraftItemProduct(
            Shop shop,
            OrderDraft draft,
            OrderInfoExtractedDto.ItemDto item,
            Product fallbackProduct,
            ProductVariant fallbackVariant
    ) {
        if (shop == null) {
            return null;
        }

        OrderInfoExtractedDto itemExtracted = OrderInfoExtractedDto.builder()
                .orderType(draft.getOrderType())
                .productId(item.getProductId())
                .variantId(item.getVariantId())
                .productName(item.getProductName())
                .productCode(item.getProductCode())
                .sku(item.getSku())
                .quantity(item.getQuantity() != null && item.getQuantity() > 0 ? item.getQuantity() : 1)
                .color(item.getColor())
                .size(item.getSize())
                .price(item.getPrice())
                .depositAmount(item.getDeposit())
                .build();

        ResolvedDraftProduct resolved = resolveDraftProduct(shop, itemExtracted);
        if (resolved != null) {
            return resolved;
        }
        return fallbackVariant != null ? new ResolvedDraftProduct(fallbackProduct, fallbackVariant) : null;
    }

    private void refreshAmounts(OrderDraft draft) {
        addPrimaryItem(draft);
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal deposit = BigDecimal.ZERO;

        if (draft.getItems() != null) {
            for (OrderDraftItem item : draft.getItems()) {
                BigDecimal price = item.getPrice() != null ? item.getPrice() : BigDecimal.ZERO;
                int quantity = item.getQuantity() != null ? item.getQuantity() : 1;
                subtotal = subtotal.add(price.multiply(BigDecimal.valueOf(quantity)));
                if (item.getDeposit() != null) {
                    deposit = deposit.add(item.getDeposit().multiply(BigDecimal.valueOf(quantity)));
                }
            }
        }

        draft.setSubtotal(subtotal);
        draft.setTotalAmount(subtotal);
        if (draft.getOrderType() == Order.OrderType.RENT) {
            draft.setDepositAmount(deposit.compareTo(BigDecimal.ZERO) > 0 ? deposit : draft.getDepositAmount());
        } else {
            draft.setDepositAmount(null);
            draft.setRentalDays(null);
            draft.setDeliveryDate(null);
            draft.setRentFrom(null);
            draft.setRentTo(null);
        }
    }

    private String buildMissingInfoMessage(List<String> missingFields) {
        return "Shop cần thêm thông tin để tạo đơn:\n"
                + missingFields.stream()
                .map(this::missingFieldLabel)
                .map(label -> "- " + label)
                .reduce((left, right) -> left + "\n" + right)
                .orElse("- Thông tin đơn hàng")
                + "\n\nBạn vui lòng bổ sung giúp shop nhé.";
    }

    private String missingFieldLabel(String field) {
        return switch (field) {
            case "phone" -> "Số điện thoại nhận hàng";
            case "address" -> "Địa chỉ giao hàng";
            case "productName" -> "Sản phẩm";
            case "variantId" -> "Biến thể/SKU sản phẩm";
            case "quantity" -> "Số lượng";
            case "orderType" -> "Loại đơn bán/thue";
            case "rentalDays" -> "Số ngày thuê";
            case "rentDates" -> "Ngày nhận/ngày thuê";
            default -> field;
        };
    }

    private String buildRentalPeriodText(OrderDraft draft) {
        if (draft.getOrderType() != Order.OrderType.RENT) {
            return "--";
        }

        List<String> parts = new ArrayList<>();
        if (draft.getRentFrom() != null && draft.getRentTo() != null) {
            parts.add(draft.getRentFrom() + " den " + draft.getRentTo());
        }
        if (draft.getRentalDays() != null) {
            parts.add(draft.getRentalDays() + " ngay");
        }
        return parts.isEmpty() ? "--" : String.join(" - ", parts);
    }

    private String buildVariantText(OrderDraft draft) {
        List<String> parts = new ArrayList<>();
        if (StringUtils.hasText(draft.getSize())) {
            parts.add("size " + draft.getSize());
        }
        if (StringUtils.hasText(draft.getColor())) {
            parts.add(draft.getColor());
        }
        return parts.isEmpty() ? "" : " (" + String.join(", ", parts) + ")";
    }

    private String buildItemVariantText(String size, String color) {
        List<String> parts = new ArrayList<>();
        if (StringUtils.hasText(size)) {
            parts.add("size " + size);
        }
        if (StringUtils.hasText(color)) {
            parts.add(color);
        }
        return String.join(", ", parts);
    }

    private boolean hasResolvedVariant(OrderDraft draft) {
        return draft.getItems() != null
                && !draft.getItems().isEmpty()
                && draft.getItems().stream().allMatch(item -> item.getProductVariant() != null);
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value.trim();
            }
        }
        return null;
    }

    @SafeVarargs
    private final <T> T firstNonNull(T... values) {
        if (values == null) {
            return null;
        }
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private String normalizeLookup(String value) {
        if (value == null) {
            return "";
        }

        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('\u0111', 'd')
                .replace('\u0110', 'D')
                .toLowerCase(Locale.ROOT)
                .trim()
                .replaceAll("\\s+", " ");
    }

    private String valueOrPlaceholder(Object value) {
        if (value == null) {
            return "Chua ro";
        }
        if (value instanceof BigDecimal decimal) {
            return decimal.stripTrailingZeros().toPlainString();
        }
        String text = String.valueOf(value).trim();
        return StringUtils.hasText(text) ? text : "Chua ro";
    }

    private String appendNote(String currentNote, String updateNote) {
        if (!StringUtils.hasText(currentNote)) {
            return updateNote;
        }
        return currentNote + "\n" + updateNote;
    }

    private void applyExtractedUpdate(OrderDraft draft, OrderInfoExtractedDto extracted) {
        if (extracted == null) {
            return;
        }

        if (StringUtils.hasText(extracted.getCustomerName())) {
            draft.setCustomerName(extracted.getCustomerName());
        }
        if (StringUtils.hasText(extracted.getPhone())) {
            draft.setPhone(extracted.getPhone());
        }
        if (StringUtils.hasText(extracted.getAddress())) {
            draft.setAddress(extracted.getAddress());
        }
        if (extracted.getOrderType() != null) {
            draft.setOrderType(extracted.getOrderType());
        }
        if (StringUtils.hasText(extracted.getProductName())) {
            draft.setProductName(extracted.getProductName());
        }
        if (StringUtils.hasText(extracted.getProductCode())) {
            draft.setProductCode(extracted.getProductCode());
        }
        if (extracted.getQuantity() != null) {
            draft.setQuantity(extracted.getQuantity());
        }
        if (StringUtils.hasText(extracted.getColor())) {
            draft.setColor(extracted.getColor());
        }
        if (StringUtils.hasText(extracted.getSize())) {
            draft.setSize(extracted.getSize());
        }
        if (extracted.getPrice() != null) {
            draft.setPrice(extracted.getPrice());
        }
        if (extracted.getDepositAmount() != null) {
            draft.setDepositAmount(extracted.getDepositAmount());
        }
        if (extracted.getRentalDays() != null) {
            draft.setRentalDays(extracted.getRentalDays());
        }
        if (extracted.getDeliveryDate() != null) {
            draft.setDeliveryDate(extracted.getDeliveryDate());
        }
        if (extracted.getRentFrom() != null) {
            draft.setRentFrom(extracted.getRentFrom());
        }
        if (extracted.getRentTo() != null) {
            draft.setRentTo(extracted.getRentTo());
        }
    }

    private String toJson(OrderInfoExtractedDto extracted) {
        try {
            return objectMapper.writeValueAsString(extracted);
        } catch (JsonProcessingException ex) {
            log.warn("Failed to serialize Messenger draft AI payload. reason={}", ex.getMessage());
            return "{}";
        }
    }

    private record ResolvedDraftProduct(Product product, ProductVariant variant) {
    }
}

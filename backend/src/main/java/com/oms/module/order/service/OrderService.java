package com.oms.module.order.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.common.dto.PageResponse;
import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.common.exception.ResourceNotFoundException;
import com.oms.module.order.dto.OrderRequest;
import com.oms.module.order.dto.OrderResponse;
import com.oms.module.order.entity.Order;
import com.oms.module.order.entity.OrderCustomFieldValue;
import com.oms.module.order.entity.OrderItem;
import com.oms.module.order.entity.OrderStatusLog;
import com.oms.module.order.mapper.OrderMapper;
import com.oms.module.order.repository.OrderRepository;
import com.oms.module.product.entity.ProductType;
import com.oms.module.product.entity.ProductVariant;
import com.oms.module.product.repository.ProductVariantRepository;
import com.oms.module.rental.entity.RentalAvailability;
import com.oms.module.rental.repository.RentalAvailabilityRepository;
import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.entity.ShopShippingMethod;
import com.oms.module.shop.entity.ShopOrderSource;
import com.oms.module.shop.repository.ShopRepository;
import com.oms.module.shop.repository.ShopShippingMethodRepository;
import com.oms.module.shop.repository.ShopOrderSourceRepository;
import com.oms.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {
    private static final String RENTAL_IDENTITY_DOCUMENT_FRONT_FIELD_KEY = "rental_identity_document_front";
    private static final String RENTAL_IDENTITY_DOCUMENT_BACK_FIELD_KEY = "rental_identity_document_back";

    private final OrderRepository orderRepository;
    private final ShopRepository shopRepository;
    private final ProductVariantRepository variantRepository;
    private final RentalAvailabilityRepository availabilityRepository;
    private final UserRepository userRepository;
    private final ShopShippingMethodRepository shippingMethodRepository;
    private final ShopOrderSourceRepository orderSourceRepository;
    private final OrderMapper orderMapper;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public PageResponse<OrderResponse> getOrders(Long shopId, Order.OrderStatus status,
                                                  Order.OrderType type, 
                                                  java.time.LocalDateTime fromDate,
                                                  java.time.LocalDateTime toDate,
                                                  String keyword,
                                                  Pageable pageable) {
        Page<Order> page = orderRepository.searchOrders(shopId, status, type, fromDate, toDate, keyword, pageable);
        return PageResponse.of(page, orderMapper.toResponseList(page.getContent()));
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrder(Long shopId, Long id) {
        Order order = orderRepository.findByIdAndShopId(id, shopId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", id));

        // Explicitly initialize lazy collections/proxies for mapping fallback
        if (order.getItems() != null) {
            order.getItems().forEach(item -> {
                if (item.getProduct() != null) {
                    item.getProduct().getImages().size(); // Trigger load
                    if (item.getProduct().getCategory() != null) {
                        item.getProduct().getCategory().getName();
                    }
                }
            });
        }

        return orderMapper.toResponse(order);
    }

    @Transactional
    public OrderResponse createOrder(Long shopId, OrderRequest request, Long creatorId) {
        log.info("Creating order for shopId: {}, creatorId: {}, sourceMethod: {}", shopId, creatorId, request.getSourceMethod());

        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new ResourceNotFoundException("Shop", shopId));

        // Determine initial status based on source method
        Order.OrderStatus initialStatus = request.getSourceMethod() == Order.SourceMethod.PUBLIC_FORM
                ? Order.OrderStatus.PENDING
                : Order.OrderStatus.NEW;

        com.oms.module.user.entity.User creator = null;
        if (creatorId != null) {
            creator = userRepository.findById(creatorId).orElse(null);
        }

        String resolvedShippingMethod = request.getShippingMethod();
        BigDecimal resolvedShippingFee = request.getShippingFee() != null ? request.getShippingFee() : BigDecimal.ZERO;
        Long resolvedShippingMethodId = request.getShippingMethodId();

        String resolvedSourceChannel = request.getSourceChannel();
        Long resolvedSourceChannelId = request.getSourceChannelId();

        if (resolvedSourceChannelId != null) {
            ShopOrderSource source = orderSourceRepository.findById(resolvedSourceChannelId)
                    .orElseThrow(() -> new ResourceNotFoundException("ShopOrderSource", resolvedSourceChannelId));
            if (!source.getShop().getId().equals(shopId)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid order source for this shop");
            }
            resolvedSourceChannel = source.getName();
        }

        if (resolvedShippingMethodId != null) {
            ShopShippingMethod method = shippingMethodRepository.findById(resolvedShippingMethodId)
                    .orElseThrow(() -> new ResourceNotFoundException("ShopShippingMethod", resolvedShippingMethodId));
            if (!method.getShop().getId().equals(shopId)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid shipping method for this shop");
            }
            resolvedShippingMethod = method.getName();
            
            if (method.getFeePolicy() == ShopShippingMethod.FeePolicy.FREESHIP || 
                method.getFeePolicy() == ShopShippingMethod.FeePolicy.CUSTOMER_PAYS_SHIPPER) {
                resolvedShippingFee = BigDecimal.ZERO;
            } else if (method.getFeePolicy() == ShopShippingMethod.FeePolicy.FIXED_FEE && method.getDefaultFee() != null) {
                resolvedShippingFee = method.getDefaultFee();
            }
        }

        Map<Long, Integer> quantitiesByVariantId = collectItemQuantities(request);
        Map<Long, ProductVariant> variantsById = lockAndValidateVariants(shopId, quantitiesByVariantId);
        validateOrderTypeCompatibility(request.getOrderType(), variantsById);
        validateVariantPrices(request.getOrderType(), variantsById);
        validateStockAvailability(request.getOrderType(), variantsById, quantitiesByVariantId);
        deductSellStockIfNeeded(request.getOrderType(), variantsById, quantitiesByVariantId);

        // Build order
        Order order = Order.builder()
                .shop(shop)
                .createdBy(creator)
                .orderCode(generateOrderCode())
                .orderType(request.getOrderType())
                .status(initialStatus)
                .customerName(request.getCustomerName())
                .customerPhone(request.getCustomerPhone())
                .customerAddress(request.getCustomerAddress())
                .customerNote(request.getCustomerNote())
                .sourceChannelId(resolvedSourceChannelId)
                .sourceChannel(resolvedSourceChannel)
                .shippingMethodId(resolvedShippingMethodId)
                .shippingMethod(resolvedShippingMethod)
                .shippingFee(resolvedShippingFee)
                .sourceMethod(request.getSourceMethod() != null ? request.getSourceMethod() : Order.SourceMethod.MANUAL)
                .paymentMethod(request.getPaymentMethod())
                .customFieldsJson(null)
                .build();

        // Add order items with snapshots + lineTotal
        BigDecimal itemsTotal = BigDecimal.ZERO;
        if (request.getItems() != null) {
            for (OrderRequest.ItemRequest itemReq : request.getItems()) {
                ProductVariant variant = variantsById.get(itemReq.getVariantId());
                int qty = resolveQuantity(itemReq);
                BigDecimal unitPrice = request.getOrderType() == Order.OrderType.SELL
                        ? variant.getPriceSell()
                        : variant.getPriceRentPerDay();
                if (unitPrice == null) unitPrice = BigDecimal.ZERO;

                BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(qty));
                itemsTotal = itemsTotal.add(lineTotal);

                String imageUrl = null;
                if (!variant.getProduct().getImages().isEmpty()) {
                    imageUrl = variant.getProduct().getImages().get(0).getUrl();
                }

                String categoryName = null;
                if (variant.getProduct().getCategory() != null) {
                    categoryName = variant.getProduct().getCategory().getName();
                }

                OrderItem item = OrderItem.builder()
                        .product(variant.getProduct())
                        .variant(variant)
                        .quantity(qty)
                        .unitPrice(unitPrice)
                        .lineTotal(lineTotal)
                        .productNameSnapshot(variant.getProduct().getName())
                        .productImageSnapshot(imageUrl)
                        .categoryNameSnapshot(categoryName)
                        .skuSnapshot(variant.getSku())
                        .variantSizeSnapshot(variant.getSize())
                        .variantColorSnapshot(variant.getColor())
                        .build();
                order.addItem(item);
            }
        }
        order.setTotalAmount(itemsTotal.add(order.getShippingFee()));
        // Save custom field values with snapshots
        if (request.getCustomFieldValues() != null) {
            for (OrderRequest.CustomFieldValueRequest cfvReq : request.getCustomFieldValues()) {
                OrderCustomFieldValue cfv = OrderCustomFieldValue.builder()
                        .fieldId(cfvReq.getFieldId())
                        .fieldKeySnapshot(cfvReq.getFieldKeySnapshot())
                        .labelSnapshot(cfvReq.getLabelSnapshot())
                        .formTypeSnapshot(cfvReq.getFormTypeSnapshot())
                        .valueJson(cfvReq.getValueJson())
                        .showInListSnapshot(Boolean.TRUE.equals(cfvReq.getShowInListSnapshot()))
                        .showInDetailSnapshot(!Boolean.FALSE.equals(cfvReq.getShowInDetailSnapshot()))
                        .sortOrderSnapshot(cfvReq.getSortOrderSnapshot() != null ? cfvReq.getSortOrderSnapshot() : 0)
                        .build();
                order.addCustomFieldValue(cfv);
            }
        }

        // Handle rental validation
        if (request.getOrderType() == Order.OrderType.RENT) {
            validateRentalDates(request, variantsById, quantitiesByVariantId);
            validateRentalVerificationDocuments(shop, request);
        }

        order = orderRepository.save(order);
        reserveRentalAvailabilityIfNeeded(order, request);
        return orderMapper.toResponse(order);
    }

    @Transactional
    public OrderResponse updateStatus(Long shopId, Long orderId, Order.OrderStatus newStatus, Long userId) {
        Order order = orderRepository.findByIdAndShopId(orderId, shopId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));

        Order.OrderStatus previousStatus = order.getStatus();
        String fromStatus = previousStatus.name();
        order.setStatus(newStatus);

        // Log status change
        OrderStatusLog log = OrderStatusLog.builder()
                .order(order)
                .fromStatus(fromStatus)
                .toStatus(newStatus.name())
                .changedBy(userId != null ? userRepository.findById(userId).orElse(null) : null)
                .build();
        order.getStatusLogs().add(log);

        order = orderRepository.save(order);
        if (previousStatus != Order.OrderStatus.CANCELLED && newStatus == Order.OrderStatus.CANCELLED) {
            releaseRentalAvailability(order.getId());
            restoreSellStock(order);
        }
        return orderMapper.toResponse(order);
    }

    // ==================== Private Helpers ====================

    /**
     * Tạo mã đơn theo format: ORD-YYYYMMDD-XXXXX
     */
    private String generateOrderCode() {
        String datePart = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        int randomPart = ThreadLocalRandom.current().nextInt(10000, 99999);
        return "ORD-" + datePart + "-" + randomPart;
    }

    private void validateRentalDates(
            OrderRequest request,
            Map<Long, ProductVariant> variantsById,
            Map<Long, Integer> quantitiesByVariantId
    ) {
        if (request.getRentFrom() == null || request.getRentTo() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Rent dates are required for rental orders");
        }
        if (request.getRentFrom().isAfter(request.getRentTo())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Rent from date must be before rent to date");
        }

        for (Map.Entry<Long, Integer> entry : quantitiesByVariantId.entrySet()) {
            Long variantId = entry.getKey();
            ProductVariant variant = variantsById.get(variantId);
            int requestedQty = entry.getValue();
            int stockQty = variant.getStockQty() != null ? variant.getStockQty() : 0;
            List<RentalAvailability> conflicts = availabilityRepository.findConflicts(
                    variantId, request.getRentFrom(), request.getRentTo());
            int reservedQty = maxConcurrentRentalBlocks(conflicts, request.getRentFrom(), request.getRentTo());
            if (reservedQty + requestedQty > stockQty) {
                throw new BusinessException(ErrorCode.RENTAL_DATE_CONFLICT);
            }
        }
    }

    private Map<Long, Integer> collectItemQuantities(OrderRequest request) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "At least one item is required");
        }

        Map<Long, Integer> quantitiesByVariantId = new LinkedHashMap<>();
        for (OrderRequest.ItemRequest itemReq : request.getItems()) {
            if (itemReq.getVariantId() == null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Variant ID must not be null");
            }
            int qty = resolveQuantity(itemReq);
            quantitiesByVariantId.merge(itemReq.getVariantId(), qty, Integer::sum);
        }
        return quantitiesByVariantId;
    }

    private int resolveQuantity(OrderRequest.ItemRequest itemReq) {
        int qty = itemReq.getQuantity() != null ? itemReq.getQuantity() : 1;
        if (qty <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Quantity must be greater than 0");
        }
        return qty;
    }

    private Map<Long, ProductVariant> lockAndValidateVariants(Long shopId, Map<Long, Integer> quantitiesByVariantId) {
        Map<Long, ProductVariant> variantsById = new LinkedHashMap<>();
        for (Long variantId : quantitiesByVariantId.keySet()) {
            ProductVariant variant = variantRepository.findByIdForUpdate(variantId)
                    .orElseThrow(() -> new ResourceNotFoundException("ProductVariant", variantId));

            if (!Boolean.TRUE.equals(variant.getIsActive())
                    || !Boolean.TRUE.equals(variant.getProduct().getIsActive())
                    || !variant.getProduct().getShop().getId().equals(shopId)) {
                throw new ResourceNotFoundException("ProductVariant", variantId);
            }

            variantsById.put(variantId, variant);
        }
        return variantsById;
    }

    private void validateOrderTypeCompatibility(
            Order.OrderType orderType,
            Map<Long, ProductVariant> variantsById
    ) {
        for (ProductVariant variant : variantsById.values()) {
            ProductType productType = variant.getProduct().getProductType();
            boolean compatible = switch (orderType) {
                case SELL -> productType == ProductType.SELL || productType == ProductType.SELL_RENT;
                case RENT -> productType == ProductType.RENT || productType == ProductType.SELL_RENT;
            };

            if (!compatible) {
                throw new BusinessException(
                        ErrorCode.VALIDATION_ERROR,
                        "Product type " + productType + " is not compatible with " + orderType + " order"
                );
            }
        }
    }

    private void validateVariantPrices(
            Order.OrderType orderType,
            Map<Long, ProductVariant> variantsById
    ) {
        for (ProductVariant variant : variantsById.values()) {
            BigDecimal unitPrice = orderType == Order.OrderType.SELL
                    ? variant.getPriceSell()
                    : variant.getPriceRentPerDay();

            if (unitPrice == null || unitPrice.compareTo(BigDecimal.ZERO) <= 0) {
                throw new BusinessException(
                        ErrorCode.VALIDATION_ERROR,
                        "Variant price is required for " + orderType + " order"
                );
            }
        }
    }

    private void validateStockAvailability(
            Order.OrderType orderType,
            Map<Long, ProductVariant> variantsById,
            Map<Long, Integer> quantitiesByVariantId
    ) {
        for (Map.Entry<Long, Integer> entry : quantitiesByVariantId.entrySet()) {
            ProductVariant variant = variantsById.get(entry.getKey());
            int requestedQty = entry.getValue();
            int stockQty = variant.getStockQty() != null ? variant.getStockQty() : 0;
            int reservedQty = orderType == Order.OrderType.SELL
                    ? maxConcurrentRentalBlocks(
                            availabilityRepository.findActiveBlocksFromDate(entry.getKey(), LocalDate.now()),
                            LocalDate.now(),
                            null
                    )
                    : 0;
            int availableQty = stockQty - reservedQty;

            if (availableQty < requestedQty) {
                String productName = variant.getProduct() != null ? variant.getProduct().getName() : "Product variant";
                throw new BusinessException(
                        ErrorCode.VARIANT_OUT_OF_STOCK,
                        productName + " chỉ còn " + Math.max(availableQty, 0) + ", không đủ cho số lượng " + requestedQty
                );
            }
        }
    }

    private void deductSellStockIfNeeded(
            Order.OrderType orderType,
            Map<Long, ProductVariant> variantsById,
            Map<Long, Integer> quantitiesByVariantId
    ) {
        if (orderType != Order.OrderType.SELL) {
            return;
        }

        for (Map.Entry<Long, Integer> entry : quantitiesByVariantId.entrySet()) {
            ProductVariant variant = variantsById.get(entry.getKey());
            int stockQty = variant.getStockQty() != null ? variant.getStockQty() : 0;
            variant.setStockQty(stockQty - entry.getValue());
        }
    }

    private void reserveRentalAvailabilityIfNeeded(Order order, OrderRequest request) {
        if (order.getOrderType() != Order.OrderType.RENT) {
            return;
        }

        List<RentalAvailability> reservations = new ArrayList<>();
        for (OrderItem item : order.getItems()) {
            int qty = item.getQuantity() != null ? item.getQuantity() : 1;
            for (int i = 0; i < qty; i++) {
                reservations.add(RentalAvailability.builder()
                        .variant(item.getVariant())
                        .order(order)
                        .startDate(request.getRentFrom())
                        .endDate(request.getRentTo())
                        .blockType(RentalAvailability.BlockType.CONFIRMED)
                        .reason("Order " + order.getOrderCode())
                        .isActive(true)
                        .build());
            }
        }

        availabilityRepository.saveAll(reservations);
    }

    private void releaseRentalAvailability(Long orderId) {
        List<RentalAvailability> blocks = availabilityRepository.findByOrderIdAndIsActiveTrue(orderId);
        for (RentalAvailability block : blocks) {
            block.setIsActive(false);
        }
        availabilityRepository.saveAll(blocks);
    }

    private void restoreSellStock(Order order) {
        if (order.getOrderType() != Order.OrderType.SELL || order.getItems() == null) {
            return;
        }

        Map<Long, Integer> quantitiesByVariantId = new HashMap<>();
        for (OrderItem item : order.getItems()) {
            if (item.getVariant() == null || item.getVariant().getId() == null) {
                continue;
            }
            quantitiesByVariantId.merge(
                    item.getVariant().getId(),
                    item.getQuantity() != null ? item.getQuantity() : 0,
                    Integer::sum
            );
        }

        for (Map.Entry<Long, Integer> entry : quantitiesByVariantId.entrySet()) {
            ProductVariant variant = variantRepository.findByIdForUpdate(entry.getKey())
                    .orElseThrow(() -> new ResourceNotFoundException("ProductVariant", entry.getKey()));
            int stockQty = variant.getStockQty() != null ? variant.getStockQty() : 0;
            variant.setStockQty(stockQty + entry.getValue());
        }
    }

    private int maxConcurrentRentalBlocks(
            List<RentalAvailability> blocks,
            LocalDate windowStart,
            LocalDate windowEnd
    ) {
        if (blocks == null || blocks.isEmpty()) {
            return 0;
        }

        TreeMap<LocalDate, Integer> deltas = new TreeMap<>();
        for (RentalAvailability block : blocks) {
            if (block.getStartDate() == null || block.getEndDate() == null) {
                continue;
            }

            LocalDate start = block.getStartDate().isBefore(windowStart) ? windowStart : block.getStartDate();
            LocalDate end = windowEnd != null && block.getEndDate().isAfter(windowEnd) ? windowEnd : block.getEndDate();
            if (end.isBefore(start)) {
                continue;
            }

            deltas.merge(start, 1, Integer::sum);
            deltas.merge(end.plusDays(1), -1, Integer::sum);
        }

        int current = 0;
        int max = 0;
        for (Integer delta : deltas.values()) {
            current += delta;
            max = Math.max(max, current);
        }
        return max;
    }

    private void validateRentalVerificationDocuments(Shop shop, OrderRequest request) {
        if (!Boolean.TRUE.equals(shop.getRentalIdentityVerificationEnabled())) {
            return;
        }

        String frontImageUrl = findCustomFieldStringValue(
                request.getCustomFieldValues(),
                RENTAL_IDENTITY_DOCUMENT_FRONT_FIELD_KEY
        );
        String backImageUrl = findCustomFieldStringValue(
                request.getCustomFieldValues(),
                RENTAL_IDENTITY_DOCUMENT_BACK_FIELD_KEY
        );

        if (!StringUtils.hasText(frontImageUrl) || !StringUtils.hasText(backImageUrl)) {
            throw new BusinessException(
                    ErrorCode.VALIDATION_ERROR,
                    "Shop yêu cầu tải đủ ảnh mặt trước và mặt sau giấy tờ tùy thân cho đơn thuê"
            );
        }
    }

    private String findCustomFieldStringValue(
            List<OrderRequest.CustomFieldValueRequest> customFieldValues,
            String fieldKey
    ) {
        if (customFieldValues == null || customFieldValues.isEmpty()) {
            return null;
        }

        return customFieldValues.stream()
                .filter(Objects::nonNull)
                .filter(field -> fieldKey.equals(field.getFieldKeySnapshot()))
                .map(this::extractCustomFieldStringValue)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse(null);
    }

    private String extractCustomFieldStringValue(OrderRequest.CustomFieldValueRequest fieldValue) {
        if (fieldValue == null || !StringUtils.hasText(fieldValue.getValueJson())) {
            return null;
        }

        try {
            return objectMapper.readValue(fieldValue.getValueJson(), String.class);
        } catch (Exception ignored) {
            return fieldValue.getValueJson().replace("\"", "").trim();
        }
    }
}

package com.oms.module.order.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.common.dto.PageResponse;
import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.common.exception.ResourceNotFoundException;
import com.oms.module.messenger.service.MessengerOrderNotificationService;
import com.oms.module.order.dto.OrderPaymentUpdateRequest;
import com.oms.module.order.dto.OrderRequest;
import com.oms.module.order.dto.OrderResponse;
import com.oms.module.order.dto.OrderUpdateRequest;
import com.oms.module.order.entity.Order;
import com.oms.module.order.entity.OrderItem;
import com.oms.module.order.entity.OrderStatusLog;
import com.oms.module.order.mapper.OrderMapper;
import com.oms.module.order.repository.OrderRepository;
import com.oms.module.orderform.service.OrderFormValueValidator;
import com.oms.module.product.entity.ProductType;
import com.oms.module.product.entity.ProductVariant;
import com.oms.module.product.repository.ProductVariantRepository;
import com.oms.module.rental.entity.RentalAvailability;
import com.oms.module.rental.repository.RentalAvailabilityRepository;
import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.entity.ShopShippingMethod;
import com.oms.module.shop.entity.ShopOrderSource;
import com.oms.module.shop.entity.ShopPaymentConfig;
import com.oms.module.shop.repository.ShopPaymentConfigRepository;
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
import java.time.temporal.ChronoUnit;
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
    private final ShopPaymentConfigRepository paymentConfigRepository;
    private final OrderMapper orderMapper;
    private final ObjectMapper objectMapper;
    private final OrderFormValueValidator orderFormValueValidator;
    private final MessengerOrderNotificationService messengerOrderNotificationService;
    private final OrderStatusTransitionService orderStatusTransitionService;

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
        return orderMapper.toResponse(createOrderEntity(shopId, request, creatorId));
    }

    @Transactional
    public Order createOrderEntity(Long shopId, OrderRequest request, Long creatorId) {
        log.info("Creating order for shopId: {}, creatorId: {}, sourceMethod: {}", shopId, creatorId, request.getSourceMethod());

        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new ResourceNotFoundException("Shop", shopId));
        validateShopCanCreateOrder(shop, request);

        Order.OrderStatus initialStatus = resolveInitialStatus(shop, request);
        boolean commitInventoryOnCreate = shouldCommitInventoryOnCreate(initialStatus, request.getSourceMethod());

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
            if (!Boolean.TRUE.equals(source.getIsActive())) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Order source is disabled for this shop");
            }
            resolvedSourceChannel = source.getName();
        }

        if (resolvedShippingMethodId != null) {
            ShopShippingMethod method = shippingMethodRepository.findById(resolvedShippingMethodId)
                    .orElseThrow(() -> new ResourceNotFoundException("ShopShippingMethod", resolvedShippingMethodId));
            if (!method.getShop().getId().equals(shopId)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid shipping method for this shop");
            }
            if (!Boolean.TRUE.equals(method.getIsActive())) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Shipping method is disabled for this shop");
            }
            resolvedShippingMethod = method.getName();
            
            if (method.getFeePolicy() == ShopShippingMethod.FeePolicy.FREESHIP || 
                method.getFeePolicy() == ShopShippingMethod.FeePolicy.CUSTOMER_PAYS_SHIPPER) {
                resolvedShippingFee = BigDecimal.ZERO;
            } else if (method.getFeePolicy() == ShopShippingMethod.FeePolicy.FIXED_FEE && method.getDefaultFee() != null) {
                resolvedShippingFee = method.getDefaultFee();
            }
        }

        validatePaymentMethod(shopId, request.getPaymentMethod());

        Map<Long, Integer> quantitiesByVariantId = collectItemQuantities(request);
        Map<Long, ProductVariant> variantsById = lockAndValidateVariants(shopId, quantitiesByVariantId);
        validateOrderTypeCompatibility(request.getOrderType(), variantsById);
        validateVariantPrices(request.getOrderType(), variantsById);
        validateStockAvailability(request.getOrderType(), variantsById, quantitiesByVariantId);
        int rentalDays = 1;
        if (request.getOrderType() == Order.OrderType.RENT) {
            validateRentalDates(request, variantsById, quantitiesByVariantId);
            rentalDays = resolveRentalDays(request.getRentFrom(), request.getRentTo());
        }
        if (commitInventoryOnCreate) {
            deductSellStockIfNeeded(request.getOrderType(), variantsById, quantitiesByVariantId);
        }

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
                .depositAmount(request.getDepositPaid() != null ? request.getDepositPaid() : BigDecimal.ZERO)
                .rentFrom(request.getRentFrom())
                .rentTo(request.getRentTo())
                .inventoryCommitted(false)
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

                BigDecimal lineTotal = unitPrice
                        .multiply(BigDecimal.valueOf(qty))
                        .multiply(BigDecimal.valueOf(rentalDays));
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
        orderFormValueValidator.buildValidatedValues(shopId, request.getOrderType(), request.getCustomFieldValues())
                .forEach(order::addCustomFieldValue);

        if (request.getOrderType() == Order.OrderType.RENT) {
            validateRentalVerificationDocuments(shop, request);
        }

        order = orderRepository.save(order);
        if (commitInventoryOnCreate) {
            reserveRentalAvailabilityIfNeeded(order);
            order.setInventoryCommitted(true);
        }
        return order;
    }

    @Transactional
    public OrderResponse updateStatus(Long shopId, Long orderId, Order.OrderStatus newStatus, Long userId) {
        return transitionOrderStatus(shopId, orderId, newStatus, userId, true);
    }

    @Transactional
    public OrderResponse confirmOrder(Long shopId, Long orderId, Long userId) {
        return transitionOrderStatus(shopId, orderId, Order.OrderStatus.CONFIRMED, userId, true);
    }

    @Transactional
    public OrderResponse markPacking(Long shopId, Long orderId, Long userId) {
        return transitionOrderStatus(shopId, orderId, Order.OrderStatus.PACKING, userId, true);
    }

    @Transactional
    public OrderResponse markShipped(Long shopId, Long orderId, Long userId) {
        return transitionOrderStatus(shopId, orderId, Order.OrderStatus.SHIPPED, userId, true);
    }

    @Transactional
    public OrderResponse markDone(Long shopId, Long orderId, Long userId) {
        return transitionOrderStatus(shopId, orderId, Order.OrderStatus.DONE, userId, true);
    }

    @Transactional
    public OrderResponse markDeposited(Long shopId, Long orderId, Long userId) {
        return transitionOrderStatus(shopId, orderId, Order.OrderStatus.DEPOSITED, userId, true);
    }

    @Transactional
    public OrderResponse markRenting(Long shopId, Long orderId, Long userId) {
        return transitionOrderStatus(shopId, orderId, Order.OrderStatus.RENTING, userId, true);
    }

    @Transactional
    public OrderResponse markOverdue(Long shopId, Long orderId, Long userId) {
        return transitionOrderStatus(shopId, orderId, Order.OrderStatus.OVERDUE, userId, true);
    }

    @Transactional
    public OrderResponse markReturned(Long shopId, Long orderId, Long userId) {
        return transitionOrderStatus(shopId, orderId, Order.OrderStatus.RETURNED, userId, true);
    }

    @Transactional
    public OrderResponse cancelOrder(Long shopId, Long orderId, Long userId) {
        return transitionOrderStatus(shopId, orderId, Order.OrderStatus.CANCELLED, userId, true);
    }

    private OrderResponse transitionOrderStatus(Long shopId, Long orderId, Order.OrderStatus newStatus, Long userId, boolean allowInventoryChange) {
        Order order = orderRepository.findByIdAndShopId(orderId, shopId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));

        orderStatusTransitionService.assertCanTransition(order, newStatus);

        Order.OrderStatus previousStatus = order.getStatus();
        boolean inventoryCommitted = isInventoryCommitted(order);
        boolean shouldNotifyMessengerConfirmed = shouldNotifyMessengerConfirmed(order, newStatus, inventoryCommitted);

        if (allowInventoryChange) {
            if (newStatus == Order.OrderStatus.CANCELLED && inventoryCommitted) {
                releaseRentalAvailability(order.getId());
                restoreSellStock(order);
                order.setInventoryCommitted(false);
            } else if (shouldCommitInventoryOnStatus(newStatus) && !inventoryCommitted) {
                commitInventory(shopId, order);
            }
        }

        String fromStatus = previousStatus.name();
        order.setStatus(newStatus);

        OrderStatusLog log = OrderStatusLog.builder()
                .order(order)
                .fromStatus(fromStatus)
                .toStatus(newStatus.name())
                .changedBy(userId != null ? userRepository.findById(userId).orElse(null) : null)
                .build();
        order.getStatusLogs().add(log);

        Order savedOrder = orderRepository.save(order);
        Order responseOrder = savedOrder != null ? savedOrder : order;
        notifyMessengerConfirmedIfNeeded(responseOrder, shouldNotifyMessengerConfirmed);
        return orderMapper.toResponse(responseOrder);
    }

    @Transactional
    public OrderResponse updateOrder(Long shopId, Long orderId, OrderUpdateRequest request) {
        Order order = orderRepository.findByIdAndShopId(orderId, shopId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));

        order.setCustomerName(request.getCustomerName());
        order.setCustomerPhone(request.getCustomerPhone());
        order.setCustomerAddress(request.getCustomerAddress());
        order.setCustomerNote(request.getCustomerNote());
        order.setSourceChannel(request.getSourceChannel());
        order.setShippingMethod(request.getShippingMethod());
        order.setShippingFee(request.getShippingFee() != null ? request.getShippingFee() : BigDecimal.ZERO);

        BigDecimal itemsTotal = order.getItems() == null
                ? BigDecimal.ZERO
                : order.getItems().stream()
                        .map(item -> item.getLineTotal() != null ? item.getLineTotal() : BigDecimal.ZERO)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
        order.setTotalAmount(itemsTotal.add(order.getShippingFee()));

        return orderMapper.toResponse(orderRepository.save(order));
    }

    @Transactional
    public OrderResponse updatePayment(Long shopId, Long orderId, OrderPaymentUpdateRequest request) {
        Order order = orderRepository.findByIdAndShopId(orderId, shopId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));

        order.setPaymentStatus(request.getPaymentStatus());
        order.setPaymentMethod(request.getPaymentMethod());

        return orderMapper.toResponse(orderRepository.save(order));
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

    private boolean shouldCommitInventoryOnCreate(
            Order.OrderStatus initialStatus,
            Order.SourceMethod sourceMethod
    ) {
        if (sourceMethod == Order.SourceMethod.MESSENGER) {
            return false;
        }
        return initialStatus != Order.OrderStatus.CANCELLED;
    }

    private boolean shouldCommitInventoryOnStatus(Order.OrderStatus status) {
        return switch (status) {
            case CONFIRMED, PACKING, SHIPPED, DONE, DEPOSITED, RENTING, OVERDUE, RETURNED -> true;
            default -> false;
        };
    }

    private boolean shouldNotifyMessengerConfirmed(
            Order order,
            Order.OrderStatus newStatus,
            boolean inventoryCommittedBeforeUpdate
    ) {
        return order.getSourceMethod() == Order.SourceMethod.MESSENGER
                && shouldCommitInventoryOnStatus(newStatus)
                && !inventoryCommittedBeforeUpdate;
    }

    private void notifyMessengerConfirmedIfNeeded(Order order, boolean shouldNotify) {
        if (!shouldNotify) {
            return;
        }

        try {
            messengerOrderNotificationService.notifyOrderConfirmed(order);
        } catch (RuntimeException ex) {
            log.warn("Failed to notify Messenger customer about confirmed order. orderId={}, reason={}",
                    order.getId(), ex.getMessage());
        }
    }

    private boolean isInventoryCommitted(Order order) {
        return Boolean.TRUE.equals(order.getInventoryCommitted());
    }

    private void commitInventory(Long shopId, Order order) {
        Map<Long, Integer> quantitiesByVariantId = collectItemQuantities(order);
        Map<Long, ProductVariant> variantsById = lockAndValidateVariants(shopId, quantitiesByVariantId);
        validateOrderTypeCompatibility(order.getOrderType(), variantsById);
        validateVariantPrices(order.getOrderType(), variantsById);
        validateStockAvailability(order.getOrderType(), variantsById, quantitiesByVariantId);

        if (order.getOrderType() == Order.OrderType.RENT) {
            validateRentalDates(order, variantsById, quantitiesByVariantId);
        }

        deductSellStockIfNeeded(order.getOrderType(), variantsById, quantitiesByVariantId);
        reserveRentalAvailabilityIfNeeded(order);
        order.setInventoryCommitted(true);
    }

    private void validateRentalDates(
            OrderRequest request,
            Map<Long, ProductVariant> variantsById,
            Map<Long, Integer> quantitiesByVariantId
    ) {
        validateRentalDates(request.getRentFrom(), request.getRentTo(), variantsById, quantitiesByVariantId);
    }

    private void validateRentalDates(
            Order order,
            Map<Long, ProductVariant> variantsById,
            Map<Long, Integer> quantitiesByVariantId
    ) {
        validateRentalDates(order.getRentFrom(), order.getRentTo(), variantsById, quantitiesByVariantId);
    }

    private void validateRentalDates(
            LocalDate rentFrom,
            LocalDate rentTo,
            Map<Long, ProductVariant> variantsById,
            Map<Long, Integer> quantitiesByVariantId
    ) {
        if (rentFrom == null || rentTo == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Rent dates are required for rental orders");
        }
        if (rentFrom.isAfter(rentTo)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Rent from date must be before rent to date");
        }

        for (Map.Entry<Long, Integer> entry : quantitiesByVariantId.entrySet()) {
            Long variantId = entry.getKey();
            ProductVariant variant = variantsById.get(variantId);
            int requestedQty = entry.getValue();
            int stockQty = variant.getStockQty() != null ? variant.getStockQty() : 0;
            List<RentalAvailability> conflicts = availabilityRepository.findConflicts(
                    variantId, rentFrom, rentTo);
            int reservedQty = maxConcurrentRentalBlocks(conflicts, rentFrom, rentTo);
            if (reservedQty + requestedQty > stockQty) {
                throw new BusinessException(ErrorCode.RENTAL_DATE_CONFLICT);
            }
        }
    }

    private int resolveRentalDays(LocalDate rentFrom, LocalDate rentTo) {
        long days = ChronoUnit.DAYS.between(rentFrom, rentTo) + 1;
        return days > 0 && days <= Integer.MAX_VALUE ? (int) days : 1;
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

    private Map<Long, Integer> collectItemQuantities(Order order) {
        if (order.getItems() == null || order.getItems().isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "At least one item is required");
        }

        Map<Long, Integer> quantitiesByVariantId = new LinkedHashMap<>();
        for (OrderItem item : order.getItems()) {
            if (item.getVariant() == null || item.getVariant().getId() == null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Variant ID must not be null");
            }
            int qty = item.getQuantity() != null ? item.getQuantity() : 1;
            if (qty <= 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Quantity must be greater than 0");
            }
            quantitiesByVariantId.merge(item.getVariant().getId(), qty, Integer::sum);
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

    private void reserveRentalAvailabilityIfNeeded(Order order) {
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
                        .startDate(order.getRentFrom())
                        .endDate(order.getRentTo())
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

    private void validatePaymentMethod(Long shopId, Order.PaymentMethod paymentMethod) {
        if (paymentMethod == null) {
            return;
        }

        ShopPaymentConfig config = paymentConfigRepository.findByShopId(shopId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.VALIDATION_ERROR,
                        "Payment method is not configured for this shop"
                ));

        boolean enabled = switch (paymentMethod) {
            case COD -> Boolean.TRUE.equals(config.getCodEnabled());
            case BANK_TRANSFER -> Boolean.TRUE.equals(config.getBankTransferEnabled());
            case VNPAY -> Boolean.TRUE.equals(config.getVnpayEnabled());
        };

        if (!enabled) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Payment method is disabled for this shop");
        }
    }

    private void validateShopCanCreateOrder(Shop shop, OrderRequest request) {
        if (request.getSourceMethod() == Order.SourceMethod.PUBLIC_FORM
                && Boolean.TRUE.equals(shop.getMaintenanceMode())) {
            throw new BusinessException(ErrorCode.SHOP_MAINTENANCE, "Shop is currently in maintenance mode");
        }

        if (request.getOrderType() == Order.OrderType.SELL && !Boolean.TRUE.equals(shop.getEnableSell())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Sell orders are disabled for this shop");
        }

        if (request.getOrderType() == Order.OrderType.RENT && !Boolean.TRUE.equals(shop.getEnableRent())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Rent orders are disabled for this shop");
        }
    }

    private Order.OrderStatus resolveInitialStatus(Shop shop, OrderRequest request) {
        if (request.getSourceMethod() == Order.SourceMethod.MESSENGER) {
            return Order.OrderStatus.PENDING;
        }

        if (request.getSourceMethod() != Order.SourceMethod.PUBLIC_FORM) {
            return Order.OrderStatus.NEW;
        }

        return Boolean.TRUE.equals(shop.getAutoAcceptOrders())
                ? Order.OrderStatus.CONFIRMED
                : Order.OrderStatus.PENDING;
    }
}

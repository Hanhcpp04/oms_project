package com.oms.module.messenger.service;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.common.exception.ResourceNotFoundException;
import com.oms.module.messenger.entity.Conversation;
import com.oms.module.messenger.entity.MessengerOrder;
import com.oms.module.messenger.entity.OrderDraft;
import com.oms.module.messenger.entity.OrderDraftItem;
import com.oms.module.messenger.enums.MessengerOrderStatus;
import com.oms.module.messenger.enums.OrderDraftStatus;
import com.oms.module.messenger.event.OrderCreatedFromMessengerEvent;
import com.oms.module.messenger.repository.MessengerOrderRepository;
import com.oms.module.messenger.repository.OrderDraftRepository;
import com.oms.module.order.dto.OrderRequest;
import com.oms.module.order.entity.Order;
import com.oms.module.order.repository.OrderRepository;
import com.oms.module.order.service.OrderService;
import com.oms.module.product.entity.ProductVariant;
import com.oms.module.product.repository.ProductVariantRepository;
import com.oms.module.shop.entity.Shop;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessengerOrderService {

    private final MessengerOrderRepository messengerOrderRepository;
    private final OrderDraftRepository orderDraftRepository;
    private final OrderRepository orderRepository;
    private final OrderDraftService orderDraftService;
    private final OrderService orderService;
    private final ApplicationEventPublisher eventPublisher;
    private final ProductVariantRepository productVariantRepository;

    @Transactional
    public Optional<Order> confirmLatestWaitingOrder(Conversation conversation) {
        return confirmLatestWaitingOrder(conversation, null);
    }

    @Transactional
    public Optional<Order> confirmLatestWaitingOrder(Conversation conversation, Order.PaymentMethod paymentMethod) {
        return orderDraftRepository.findTopByConversationIdAndStatusInOrderByCreatedAtDesc(
                        conversation.getId(),
                        OrderDraftService.CONFIRMABLE_DRAFT_STATUSES
                )
                .map(OrderDraft::getId)
                .map(draftId -> confirmDraftOrder(draftId, paymentMethod));
    }

    @Transactional
    public Order confirmDraftManually(Long shopId, Long draftId) {
        return confirmDraftOrder(draftId, null, shopId);
    }

    @Transactional(readOnly = true)
    public Page<MessengerOrder> getOrders(Long shopId, Pageable pageable) {
        return messengerOrderRepository.findAllByOrderDraftShopId(shopId, pageable);
    }

    private Order confirmDraftOrder(Long draftId, Order.PaymentMethod paymentMethod) {
        return confirmDraftOrder(draftId, paymentMethod, null);
    }

    private Order confirmDraftOrder(Long draftId, Order.PaymentMethod paymentMethod, Long expectedShopId) {
        OrderDraft draft = (expectedShopId == null
                ? orderDraftRepository.findByIdForUpdate(draftId)
                : orderDraftRepository.findByIdAndShopIdForUpdate(draftId, expectedShopId))
                .orElseThrow(() -> new ResourceNotFoundException("OrderDraft", draftId));

        if (draft.getStatus() == OrderDraftStatus.CONVERTED_TO_ORDER && draft.getConvertedOrder() != null) {
            return draft.getConvertedOrder();
        }

        if (draft.getStatus() == OrderDraftStatus.CANCELLED || draft.getStatus() == OrderDraftStatus.EXPIRED) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Cannot confirm an order draft with status " + draft.getStatus());
        }

        if (orderDraftService.isExpired(draft)) {
            draft.setStatus(OrderDraftStatus.EXPIRED);
            orderDraftRepository.save(draft);
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Order draft is expired");
        }

        List<String> blockingMissing = orderDraftService.findBlockingMissingFields(draft);
        if (!blockingMissing.isEmpty()) {
            draft.setStatus(OrderDraftStatus.NEED_MORE_INFO);
            draft.setConfirmMessage(orderDraftService.buildConfirmMessage(draft));
            orderDraftRepository.save(draft);
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Order draft is missing required fields: " + String.join(", ", blockingMissing));
        }

        Shop shop = draft.getShop();
        if (shop == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Cannot confirm Messenger draft because shop is not resolved for page " + draft.getPageId());
        }

        orderDraftService.validateDraftCanCreateOrder(draft);

        Order savedOrder = orderService.createOrderEntity(shop.getId(), toOrderRequest(draft, paymentMethod), null);
        savedOrder.setPaymentStatus(Order.PaymentStatus.UNPAID);
        savedOrder.setMessengerPageId(draft.getPageId());
        savedOrder.setMessengerCustomerPsid(draft.getCustomerPsid());
        savedOrder.setMessengerConversationId(draft.getConversation() != null ? draft.getConversation().getId() : null);
        savedOrder.setMessengerDraftId(draft.getId());
        savedOrder = orderRepository.save(savedOrder);
        createLegacyMessengerOrderIfNeeded(draft);

        draft.setStatus(OrderDraftStatus.CONVERTED_TO_ORDER);
        draft.setConvertedOrder(savedOrder);
        draft.setConfirmedAt(LocalDateTime.now());
        orderDraftRepository.save(draft);

        eventPublisher.publishEvent(new OrderCreatedFromMessengerEvent(
                shop.getId(),
                savedOrder.getId(),
                draft.getId(),
                draft.getCustomerPsid(),
                "MESSENGER"
        ));

        log.info("Converted Messenger draft into OMS order: draftId={}, orderId={}, conversationId={}",
                draft.getId(), savedOrder.getId(),
                draft.getConversation() != null ? draft.getConversation().getId() : null);
        return savedOrder;
    }

    private OrderRequest toOrderRequest(OrderDraft draft, Order.PaymentMethod paymentMethod) {
        List<OrderDraftItem> draftItems = draft.getItems();
        if (draftItems == null || draftItems.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Order draft does not contain a resolved product variant");
        }

        OrderRequest request = new OrderRequest();
        request.setOrderType(draft.getOrderType());
        request.setCustomerName(draft.getCustomerName());
        request.setCustomerPhone(draft.getPhone());
        request.setCustomerAddress(draft.getAddress());
        request.setCustomerNote(draft.getNote());
        request.setSourceChannel("MESSENGER");
        request.setShippingMethodId(draft.getShippingMethodId());
        request.setShippingMethod(draft.getShippingMethod());
        request.setShippingFee(draft.getShippingFee() != null ? draft.getShippingFee() : BigDecimal.ZERO);
        request.setSourceMethod(Order.SourceMethod.MESSENGER);
        request.setPaymentMethod(paymentMethod);
        request.setRentFrom(draft.getRentFrom());
        request.setRentTo(draft.getRentTo());
        request.setDepositPaid(BigDecimal.ZERO);
        request.setItems(draftItems.stream()
                .map(item -> toOrderItemRequest(draft, item))
                .toList());
        return request;
    }

    private OrderRequest.ItemRequest toOrderItemRequest(OrderDraft draft, OrderDraftItem draftItem) {
        ProductVariant variant = resolveDraftItemVariant(draft, draftItem);
        OrderRequest.ItemRequest request = new OrderRequest.ItemRequest();
        request.setVariantId(variant.getId());
        request.setQuantity(draftItem.getQuantity() != null && draftItem.getQuantity() > 0 ? draftItem.getQuantity() : 1);
        return request;
    }

    private ProductVariant resolveDraftItemVariant(OrderDraft draft, OrderDraftItem item) {
        if (item.getProductVariant() != null) {
            return item.getProductVariant();
        }

        Long shopId = draft.getShop() != null ? draft.getShop().getId() : null;
        if (shopId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Cannot resolve product variant because draft shop is missing");
        }

        String sku = StringUtils.hasText(item.getSku()) ? item.getSku() : item.getProductCode();
        if (StringUtils.hasText(sku)) {
            return productVariantRepository.findFirstBySkuIgnoreCaseAndProductShopIdAndIsActiveTrue(sku, shopId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR,
                            "Order draft item SKU does not match an active product variant"));
        }

        throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                "Order draft item is missing Variant ID/SKU");
    }

    private void createLegacyMessengerOrderIfNeeded(OrderDraft draft) {
        if (messengerOrderRepository.findByOrderDraftId(draft.getId()).isPresent()) {
            return;
        }

        MessengerOrder order = MessengerOrder.builder()
                .orderDraft(draft)
                .conversation(draft.getConversation())
                .customerName(draft.getCustomerName())
                .phone(draft.getPhone())
                .address(draft.getAddress())
                .productName(draft.getProductName())
                .productCode(draft.getProductCode())
                .quantity(draft.getQuantity())
                .color(draft.getColor())
                .size(draft.getSize())
                .price(draft.getPrice())
                .note(draft.getNote())
                .status(MessengerOrderStatus.NEW)
                .build();
        messengerOrderRepository.save(order);
    }

}

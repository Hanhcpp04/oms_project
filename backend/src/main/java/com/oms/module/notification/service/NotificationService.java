package com.oms.module.notification.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.common.dto.PageResponse;
import com.oms.common.exception.ResourceNotFoundException;
import com.oms.module.notification.dto.NotificationResponse;
import com.oms.module.notification.entity.Notification;
import com.oms.module.notification.event.NotificationCreatedEvent;
import com.oms.module.notification.repository.NotificationRepository;
import com.oms.module.order.entity.Order;
import com.oms.module.payment.entity.Payment;
import com.oms.module.shop.entity.Shop;
import com.oms.module.user.entity.User;
import jakarta.persistence.EntityManager;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final String ENTITY_ORDER = "ORDER";
    private static final Locale VIETNAM = Locale.forLanguageTag("vi-VN");

    private final NotificationRepository notificationRepository;
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public PageResponse<NotificationResponse> getNotifications(Long shopId, Pageable pageable) {
        var page = notificationRepository.findByShopIdOrderByCreatedAtDesc(shopId, pageable);
        return PageResponse.of(page, page.getContent().stream().map(this::toResponse).toList());
    }

    @Transactional(readOnly = true)
    public long countUnread(Long shopId) {
        return notificationRepository.countByShopIdAndReadAtIsNull(shopId);
    }

    @Transactional
    public NotificationResponse markRead(Long shopId, Long notificationId) {
        Notification notification = notificationRepository.findByIdAndShopId(notificationId, shopId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification", notificationId));

        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
        }

        return toResponse(notificationRepository.save(notification));
    }

    @Transactional
    public long markAllRead(Long shopId) {
        return notificationRepository.markAllReadByShopId(shopId, LocalDateTime.now());
    }

    @Transactional
    public void notifyOrderCreated(Order order) {
        if (!canNotify(order)) {
            return;
        }

        Notification.Type type = switch (order.getSourceMethod()) {
            case PUBLIC_FORM -> Notification.Type.ORDER_CREATED_PUBLIC_FORM;
            case MESSENGER -> Notification.Type.ORDER_CREATED_MESSENGER;
            default -> null;
        };

        if (type == null) {
            return;
        }

        String source = type == Notification.Type.ORDER_CREATED_MESSENGER ? "Messenger" : "public form";
        create(NotificationRequest.builder()
                .shopId(order.getShop().getId())
                .type(type)
                .severity(Notification.Severity.INFO)
                .title("Co don hang moi")
                .message("Don " + displayOrderCode(order) + " vua duoc tao tu " + source + ".")
                .entityType(ENTITY_ORDER)
                .entityId(order.getId())
                .linkUrl(orderLink(order))
                .payload(Map.of(
                        "orderCode", displayOrderCode(order),
                        "sourceMethod", order.getSourceMethod().name()
                ))
                .build());
    }

    @Transactional
    public void notifyOrderPaymentUpdated(Order order, Order.PaymentStatus previousStatus) {
        if (!canNotify(order) || order.getPaymentStatus() == null || order.getPaymentStatus() == previousStatus) {
            return;
        }

        if (order.getPaymentStatus() == Order.PaymentStatus.PAID) {
            createOrderPaymentNotification(
                    order,
                    Notification.Type.ORDER_PAID,
                    Notification.Severity.SUCCESS,
                    "Don hang da thanh toan",
                    "Don " + displayOrderCode(order) + " da duoc thanh toan.",
                    order.getTotalAmount()
            );
            return;
        }

        if (order.getPaymentStatus() == Order.PaymentStatus.DEPOSITED) {
            createOrderPaymentNotification(
                    order,
                    Notification.Type.ORDER_DEPOSITED,
                    Notification.Severity.SUCCESS,
                    "Don hang da dat coc",
                    "Don " + displayOrderCode(order) + " da duoc ghi nhan dat coc.",
                    order.getDepositAmount()
            );
        }
    }

    @Transactional
    public void notifyPaymentReceived(Order order, Payment.Purpose purpose, BigDecimal amount) {
        if (!canNotify(order)) {
            return;
        }

        if (purpose == Payment.Purpose.RENTAL_DEPOSIT) {
            createOrderPaymentNotification(
                    order,
                    Notification.Type.ORDER_DEPOSITED,
                    Notification.Severity.SUCCESS,
                    "Don hang da dat coc",
                    "Don " + displayOrderCode(order) + " da nhan tien coc " + formatMoney(amount) + ".",
                    amount
            );
            return;
        }

        createOrderPaymentNotification(
                order,
                Notification.Type.ORDER_PAID,
                Notification.Severity.SUCCESS,
                "Don hang da thanh toan",
                "Don " + displayOrderCode(order) + " da thanh toan " + formatMoney(amount) + ".",
                amount
        );
    }

    @Transactional
    public void notifyPaymentTimeoutReminder(Order order, int remainingMinutes) {
        if (!canNotify(order)) {
            return;
        }

        create(NotificationRequest.builder()
                .shopId(order.getShop().getId())
                .type(Notification.Type.PAYMENT_TIMEOUT_REMINDER)
                .severity(Notification.Severity.WARNING)
                .title("Don sap bi huy")
                .message("Don " + displayOrderCode(order) + " se bi huy sau "
                        + remainingMinutes + " phut neu chua thanh toan.")
                .entityType(ENTITY_ORDER)
                .entityId(order.getId())
                .linkUrl(orderLink(order))
                .payload(Map.of(
                        "orderCode", displayOrderCode(order),
                        "remainingMinutes", remainingMinutes
                ))
                .build());
    }

    @Transactional
    public void notifyPaymentTimeoutCancelled(Order order, int cancelMinutes) {
        if (!canNotify(order)) {
            return;
        }

        create(NotificationRequest.builder()
                .shopId(order.getShop().getId())
                .type(Notification.Type.ORDER_AUTO_CANCELLED_PAYMENT_TIMEOUT)
                .severity(Notification.Severity.ERROR)
                .title("Don da tu dong huy")
                .message("Don " + displayOrderCode(order) + " da bi huy do qua han thanh toan "
                        + cancelMinutes + " phut.")
                .entityType(ENTITY_ORDER)
                .entityId(order.getId())
                .linkUrl(orderLink(order))
                .payload(Map.of(
                        "orderCode", displayOrderCode(order),
                        "cancelMinutes", cancelMinutes,
                        "reason", "PAYMENT_TIMEOUT"
                ))
                .build());
    }

    private void createOrderPaymentNotification(
            Order order,
            Notification.Type type,
            Notification.Severity severity,
            String title,
            String message,
            BigDecimal amount
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("orderCode", displayOrderCode(order));
        payload.put("paymentStatus", order.getPaymentStatus() != null ? order.getPaymentStatus().name() : null);
        payload.put("amount", amount);

        create(NotificationRequest.builder()
                .shopId(order.getShop().getId())
                .type(type)
                .severity(severity)
                .title(title)
                .message(message)
                .entityType(ENTITY_ORDER)
                .entityId(order.getId())
                .linkUrl(orderLink(order))
                .payload(payload)
                .build());
    }

    private NotificationResponse create(NotificationRequest request) {
        Notification notification = Notification.builder()
                .shop(entityManager.getReference(Shop.class, request.shopId()))
                .recipientUser(request.recipientUserId() != null
                        ? entityManager.getReference(User.class, request.recipientUserId())
                        : null)
                .type(request.type())
                .severity(request.severity())
                .title(request.title())
                .message(request.message())
                .entityType(request.entityType())
                .entityId(request.entityId())
                .linkUrl(request.linkUrl())
                .payloadJson(writePayload(request.payload()))
                .build();

        NotificationResponse response = toResponse(notificationRepository.save(notification));
        eventPublisher.publishEvent(new NotificationCreatedEvent(request.shopId(), response));
        return response;
    }

    private boolean canNotify(Order order) {
        return order != null
                && order.getId() != null
                && order.getShop() != null
                && order.getShop().getId() != null
                && !Boolean.FALSE.equals(order.getShop().getNotificationsEnabled());
    }

    private NotificationResponse toResponse(Notification notification) {
        return NotificationResponse.builder()
                .id(notification.getId())
                .type(notification.getType())
                .severity(notification.getSeverity())
                .title(notification.getTitle())
                .message(notification.getMessage())
                .entityType(notification.getEntityType())
                .entityId(notification.getEntityId())
                .linkUrl(notification.getLinkUrl())
                .payloadJson(notification.getPayloadJson())
                .read(notification.getReadAt() != null)
                .readAt(notification.getReadAt())
                .createdAt(notification.getCreatedAt())
                .updatedAt(notification.getUpdatedAt())
                .build();
    }

    private String writePayload(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return null;
        }

        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    private String displayOrderCode(Order order) {
        if (order.getOrderCode() != null && !order.getOrderCode().isBlank()) {
            return order.getOrderCode();
        }

        return "#" + order.getId();
    }

    private String orderLink(Order order) {
        return order.getId() != null ? "/app/orders/" + order.getId() : null;
    }

    private String formatMoney(BigDecimal amount) {
        if (amount == null) {
            return "0 VND";
        }

        return NumberFormat.getCurrencyInstance(VIETNAM).format(amount);
    }

    @Builder
    private record NotificationRequest(
            Long shopId,
            Long recipientUserId,
            Notification.Type type,
            Notification.Severity severity,
            String title,
            String message,
            String entityType,
            Long entityId,
            String linkUrl,
            Map<String, Object> payload
    ) {
    }
}

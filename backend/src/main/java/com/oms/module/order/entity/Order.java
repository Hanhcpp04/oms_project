package com.oms.module.order.entity;

import com.oms.common.base.BaseEntity;
import com.oms.module.shop.entity.Shop;
import com.oms.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Order entity - supports both sell and rent order types.
 */
@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_id", nullable = false)
    private Shop shop;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    private User createdBy;

    @Column(name = "order_code", unique = true, length = 20)
    private String orderCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "order_type", length = 20, nullable = false, columnDefinition = "enum('RENT','SELL')")
    private OrderType orderType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false, columnDefinition = "enum('CANCELLED','CONFIRMED','DEPOSITED','DONE','NEW','OVERDUE','PACKING','PAID','PENDING','RENTING','RETURNED','SHIPPED')")
    @Builder.Default
    private OrderStatus status = OrderStatus.NEW;

    @Column(name = "customer_name", length = 100)
    private String customerName;

    @Column(name = "customer_phone", length = 20)
    private String customerPhone;

    @Column(name = "customer_address", columnDefinition = "TEXT")
    private String customerAddress;

    @Column(name = "customer_note", columnDefinition = "TEXT")
    private String customerNote;

    @Column(name = "source_channel", length = 50)
    private String sourceChannel;

    @Column(name = "source_channel_id")
    private Long sourceChannelId;

    @Column(name = "shipping_method_id")
    private Long shippingMethodId;

    @Column(name = "shipping_method", length = 100)
    private String shippingMethod;

    @Column(name = "shipping_fee", precision = 12, scale = 0)
    @Builder.Default
    private BigDecimal shippingFee = BigDecimal.ZERO;

    @Column(name = "total_amount", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "deposit_amount", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal depositAmount = BigDecimal.ZERO;

    @Column(name = "rent_from")
    private LocalDate rentFrom;

    @Column(name = "rent_to")
    private LocalDate rentTo;

    @Column(name = "inventory_committed", nullable = false)
    @Builder.Default
    private Boolean inventoryCommitted = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", length = 20, columnDefinition = "enum('DEPOSITED','PAID','UNPAID')")
    @Builder.Default
    private PaymentStatus paymentStatus = PaymentStatus.UNPAID;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", length = 20, columnDefinition = "enum('BANK_TRANSFER','COD','VNPAY')")
    private PaymentMethod paymentMethod;

    @Column(name = "custom_fields_json", columnDefinition = "JSON")
    private String customFieldsJson;

    @Column(name = "messenger_page_id", length = 100)
    private String messengerPageId;

    @Column(name = "messenger_customer_psid", length = 100)
    private String messengerCustomerPsid;

    @Column(name = "messenger_conversation_id")
    private Long messengerConversationId;

    @Column(name = "messenger_draft_id")
    private Long messengerDraftId;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_method", length = 20, columnDefinition = "enum('AI_PARSE','MANUAL','MESSENGER','PUBLIC_FORM')")
    @Builder.Default
    private SourceMethod sourceMethod = SourceMethod.MANUAL;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<OrderItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL)
    @Builder.Default
    private List<OrderStatusLog> statusLogs = new ArrayList<>();

    // ==================== Enums ====================

    public enum OrderType {
        SELL, RENT
    }

    public enum OrderStatus {
        PENDING, NEW, CONFIRMED, PACKING, SHIPPED, DONE,
        CANCELLED, DEPOSITED, PAID, RENTING, OVERDUE, RETURNED
    }

    public enum PaymentStatus {
        UNPAID, DEPOSITED, PAID
    }

    public enum PaymentMethod {
        COD, BANK_TRANSFER, VNPAY
    }

    public enum SourceMethod {
        MANUAL, AI_PARSE, PUBLIC_FORM, MESSENGER
    }

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<OrderCustomFieldValue> customFieldValues = new ArrayList<>();

    // ==================== Helper ====================

    public void addItem(OrderItem item) {
        items.add(item);
        item.setOrder(this);
    }

    public void addCustomFieldValue(OrderCustomFieldValue cfv) {
        customFieldValues.add(cfv);
        cfv.setOrder(this);
    }

    public boolean canTransitionTo(OrderStatus targetStatus) {
        if (targetStatus == null || status == null) {
            return false;
        }
        if (status == targetStatus) {
            return true;
        }
        if (status == OrderStatus.CANCELLED || status == OrderStatus.DONE || status == OrderStatus.RETURNED) {
            return false;
        }

        return switch (orderType) {
            case SELL -> canTransitionSellTo(targetStatus);
            case RENT -> canTransitionRentTo(targetStatus);
        };
    }

    private boolean canTransitionSellTo(OrderStatus targetStatus) {
        return switch (status) {
            case NEW, PENDING -> targetStatus == OrderStatus.CONFIRMED || targetStatus == OrderStatus.CANCELLED;
            case CONFIRMED -> targetStatus == OrderStatus.PACKING || targetStatus == OrderStatus.CANCELLED;
            case PACKING -> targetStatus == OrderStatus.SHIPPED || targetStatus == OrderStatus.CANCELLED;
            case SHIPPED -> targetStatus == OrderStatus.DONE;
            case PAID -> targetStatus == OrderStatus.CONFIRMED || targetStatus == OrderStatus.CANCELLED;
            default -> false;
        };
    }

    private boolean canTransitionRentTo(OrderStatus targetStatus) {
        return switch (status) {
            case NEW, PENDING -> targetStatus == OrderStatus.CONFIRMED || targetStatus == OrderStatus.CANCELLED;
            case CONFIRMED -> targetStatus == OrderStatus.DEPOSITED || targetStatus == OrderStatus.RENTING || targetStatus == OrderStatus.CANCELLED;
            case DEPOSITED -> targetStatus == OrderStatus.RENTING || targetStatus == OrderStatus.CANCELLED;
            case RENTING -> targetStatus == OrderStatus.OVERDUE || targetStatus == OrderStatus.RETURNED || targetStatus == OrderStatus.DONE || targetStatus == OrderStatus.CANCELLED;
            case OVERDUE -> targetStatus == OrderStatus.RETURNED || targetStatus == OrderStatus.DONE || targetStatus == OrderStatus.CANCELLED;
            default -> false;
        };
    }
}

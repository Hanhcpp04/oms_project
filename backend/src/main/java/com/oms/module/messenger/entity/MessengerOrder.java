package com.oms.module.messenger.entity;

import com.oms.common.base.BaseEntity;
import com.oms.module.messenger.enums.MessengerOrderStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity(name = "MessengerOrder")
@Table(
        name = "messenger_orders",
        indexes = {
                @Index(name = "idx_messenger_order_draft_id", columnList = "order_draft_id", unique = true),
                @Index(name = "idx_messenger_order_conversation_id", columnList = "conversation_id"),
                @Index(name = "idx_messenger_order_created_at", columnList = "created_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessengerOrder extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_draft_id", nullable = false)
    private OrderDraft orderDraft;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @Column(name = "customer_name", length = 150)
    private String customerName;

    @Column(name = "phone", length = 30)
    private String phone;

    @Lob
    @Column(name = "address", columnDefinition = "TEXT")
    private String address;

    @Column(name = "product_name", length = 255)
    private String productName;

    @Column(name = "product_code", length = 100)
    private String productCode;

    @Column(name = "quantity")
    private Integer quantity;

    @Column(name = "color", length = 80)
    private String color;

    @Column(name = "product_size", length = 50)
    private String size;

    @Column(name = "price", precision = 15, scale = 2)
    private BigDecimal price;

    @Lob
    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private MessengerOrderStatus status = MessengerOrderStatus.NEW;
}

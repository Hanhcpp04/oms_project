package com.oms.module.payment.entity;

import com.oms.common.base.BaseEntity;
import com.oms.module.order.entity.Order;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "payments",
        indexes = {
                @Index(name = "idx_payments_order_id", columnList = "order_id"),
                @Index(name = "idx_payments_provider_order_code", columnList = "provider_order_code"),
                @Index(name = "idx_payments_provider_payment_link_id", columnList = "provider_payment_link_id")
        },
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_payments_provider_order_code", columnNames = {"provider", "provider_order_code"}),
                @UniqueConstraint(name = "uk_payments_provider_link_id", columnNames = {"provider", "provider_payment_link_id"})
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", length = 20, nullable = false)
    private Provider provider;

    @Enumerated(EnumType.STRING)
    @Column(name = "method", length = 30, nullable = false)
    private Method method;

    @Enumerated(EnumType.STRING)
    @Column(name = "purpose", length = 30, nullable = false)
    @Builder.Default
    private Purpose purpose = Purpose.ORDER_FULL;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(name = "amount", precision = 15, scale = 0, nullable = false)
    private BigDecimal amount;

    @Column(name = "currency", length = 10, nullable = false)
    @Builder.Default
    private String currency = "VND";

    @Column(name = "provider_order_code")
    private Long providerOrderCode;

    @Column(name = "provider_payment_link_id", length = 100)
    private String providerPaymentLinkId;

    @Column(name = "checkout_url", length = 1024)
    private String checkoutUrl;

    @Column(name = "qr_code", columnDefinition = "TEXT")
    private String qrCode;

    @Column(name = "qr_image_url", length = 1024)
    private String qrImageUrl;

    @Column(name = "description", length = 255)
    private String description;

    @Column(name = "provider_status", length = 30)
    private String providerStatus;

    @Column(name = "provider_reference", length = 100)
    private String providerReference;

    @Column(name = "webhook_payload_json", columnDefinition = "TEXT")
    private String webhookPayloadJson;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @Column(name = "failure_reason", length = 500)
    private String failureReason;

    public enum Provider {
        PAYOS
    }

    public enum Method {
        BANK_TRANSFER
    }

    public enum Purpose {
        ORDER_FULL, RENTAL_DEPOSIT
    }

    public enum Status {
        PENDING, PAID, CANCELLED, FAILED, EXPIRED
    }
}

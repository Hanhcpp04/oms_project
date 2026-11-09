package com.oms.module.notification.entity;

import com.oms.common.base.BaseEntity;
import com.oms.module.shop.entity.Shop;
import com.oms.module.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "notifications",
        indexes = {
                @Index(name = "idx_notifications_shop_created", columnList = "shop_id, created_at"),
                @Index(name = "idx_notifications_shop_read", columnList = "shop_id, read_at"),
                @Index(name = "idx_notifications_entity", columnList = "entity_type, entity_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_id", nullable = false)
    private Shop shop;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_user_id")
    private User recipientUser;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", length = 60, nullable = false)
    private Type type;

    @Enumerated(EnumType.STRING)
    @Column(name = "severity", length = 20, nullable = false)
    @Builder.Default
    private Severity severity = Severity.INFO;

    @Column(name = "title", length = 150, nullable = false)
    private String title;

    @Column(name = "message", length = 500, nullable = false)
    private String message;

    @Column(name = "entity_type", length = 40)
    private String entityType;

    @Column(name = "entity_id")
    private Long entityId;

    @Column(name = "link_url", length = 255)
    private String linkUrl;

    @Column(name = "payload_json", columnDefinition = "TEXT")
    private String payloadJson;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    public enum Type {
        ORDER_CREATED_PUBLIC_FORM,
        ORDER_CREATED_MESSENGER,
        ORDER_PAID,
        ORDER_DEPOSITED,
        PAYMENT_TIMEOUT_REMINDER,
        ORDER_AUTO_CANCELLED_PAYMENT_TIMEOUT
    }

    public enum Severity {
        INFO, SUCCESS, WARNING, ERROR
    }
}

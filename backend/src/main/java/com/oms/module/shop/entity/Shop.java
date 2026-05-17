package com.oms.module.shop.entity;

import com.oms.common.base.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * Shop entity - represents a shop registered on the platform.
 * Multi-tenant: most data is scoped to a shop.
 */
@Entity
@Table(name = "shops")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Shop extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 150)
    private String email;

    @Column(length = 20)
    private String phone;

    @Column(length = 50, unique = true)
    private String slug;

    @Column(length = 255)
    private String logoUrl;

    @Column(name = "support_email", length = 150)
    private String supportEmail;

    @Column(name = "support_phone", length = 30)
    private String supportPhone;

    @Column(name = "business_mode", length = 20)
    private String businessMode; // SELL, RENT, BOTH

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false, columnDefinition = "enum('ACTIVE','PENDING','SUSPENDED')")
    @Builder.Default
    private ShopStatus status = ShopStatus.PENDING;

    @Column(nullable = false)
    @Builder.Default
    private Integer tokenVersion = 0;

    @Column(name = "enable_sell", nullable = false)
    @Builder.Default
    private Boolean enableSell = true;

    @Column(name = "enable_rent", nullable = false)
    @Builder.Default
    private Boolean enableRent = true;

    @Column(name = "notifications_enabled", nullable = false)
    @Builder.Default
    private Boolean notificationsEnabled = true;

    @Column(name = "maintenance_mode", nullable = false)
    @Builder.Default
    private Boolean maintenanceMode = false;

    @Column(name = "auto_accept_orders", nullable = false)
    @Builder.Default
    private Boolean autoAcceptOrders = false;

    @Column(name = "show_inventory_on_storefront", nullable = false)
    @Builder.Default
    private Boolean showInventoryOnStorefront = true;

    @Column(name = "rental_identity_verification_enabled", nullable = false)
    @Builder.Default
    private Boolean rentalIdentityVerificationEnabled = false;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isDeleted = false;

    public enum ShopStatus {
        PENDING, ACTIVE, SUSPENDED
    }
}

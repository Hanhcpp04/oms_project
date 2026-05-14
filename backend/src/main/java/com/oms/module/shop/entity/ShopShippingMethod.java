package com.oms.module.shop.entity;

import com.oms.common.base.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

/**
 * ShopShippingMethod entity - represents a custom shipping method configured by a shop.
 */
@Entity
@Table(name = "shop_shipping_methods")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShopShippingMethod extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_id", nullable = false)
    private Shop shop;

    @Column(nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "fee_policy", nullable = false, length = 30)
    private FeePolicy feePolicy;

    @Column(name = "default_fee", precision = 12, scale = 0)
    @Builder.Default
    private BigDecimal defaultFee = BigDecimal.ZERO;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    public enum FeePolicy {
        FREESHIP,                // Miễn phí vận chuyển (Phí = 0)
        CUSTOMER_PAYS_SHIPPER,   // Khách thanh toán cho shipper (Phí = 0 trên hệ thống)
        FIXED_FEE                // Thu phí cố định trước (Phí = defaultFee)
    }
}

package com.oms.module.shop.entity;

import com.oms.common.base.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * ShopOrderSource entity - represents an order platform or source channel configured by a shop.
 */
@Entity
@Table(name = "shop_order_sources")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShopOrderSource extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_id", nullable = false)
    private Shop shop;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;
}

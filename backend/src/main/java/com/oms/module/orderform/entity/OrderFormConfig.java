package com.oms.module.orderform.entity;

import com.oms.common.base.BaseEntity;
import com.oms.module.product.entity.ProductType;
import com.oms.module.shop.entity.Shop;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "order_form_configs", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"shop_id", "form_type"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderFormConfig extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_id", nullable = false)
    private Shop shop;

    @Enumerated(EnumType.STRING)
    @Column(name = "form_type", nullable = false, length = 10, columnDefinition = "enum('RENT','SELL','SELL_RENT')")
    private ProductType formType;

    @OneToMany(mappedBy = "config", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    @Builder.Default
    private List<OrderFormCustomField> customFields = new ArrayList<>();
}

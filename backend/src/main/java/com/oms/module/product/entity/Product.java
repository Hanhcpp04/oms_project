package com.oms.module.product.entity;

import com.oms.common.base.BaseEntity;
import com.oms.module.shop.entity.Shop;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

/**
 * Product entity - supports both selling and renting.
 */
@Entity
@Table(name = "products", indexes = {
        @Index(name = "idx_products_shop_active", columnList = "shop_id,is_active"),
        @Index(name = "idx_products_shop_type", columnList = "shop_id,product_type")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_id", nullable = false)
    private Shop shop;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 200)
    private String slug;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private com.oms.module.shop.entity.ShopCategory category;

    @Enumerated(EnumType.STRING)
    @Column(name = "product_type", length = 20, nullable = false, columnDefinition = "enum('RENT','SELL','SELL_RENT')")
    private ProductType productType;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ProductVariant> variants = new ArrayList<>();

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ProductImage> images = new ArrayList<>();

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ProductCustomAttributeValue> customAttributeValues = new ArrayList<>();

    // ==================== Helper Methods ====================

    public void addVariant(ProductVariant variant) {
        variants.add(variant);
        variant.setProduct(this);
    }

    public void addImage(ProductImage image) {
        images.add(image);
        image.setProduct(this);
    }

    public void addCustomAttributeValue(ProductCustomAttributeValue value) {
        customAttributeValues.add(value);
        value.setProduct(this);
    }
}

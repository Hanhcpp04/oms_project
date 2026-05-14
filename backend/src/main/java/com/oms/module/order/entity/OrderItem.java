package com.oms.module.order.entity;

import com.oms.common.base.BaseEntity;
import com.oms.module.product.entity.Product;
import com.oms.module.product.entity.ProductVariant;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "order_items")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OrderItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "variant_id")
    private ProductVariant variant;

    // Snapshot fields — lưu tại thời điểm tạo đơn
    @Column(name = "product_name_snapshot", length = 255)
    private String productNameSnapshot;

    @Column(name = "product_image_snapshot", length = 500)
    private String productImageSnapshot;

    @Column(name = "category_name_snapshot", length = 100)
    private String categoryNameSnapshot;

    @Column(name = "sku_snapshot", length = 100)
    private String skuSnapshot;

    @Column(name = "variant_size_snapshot", length = 50)
    private String variantSizeSnapshot;

    @Column(name = "variant_color_snapshot", length = 50)
    private String variantColorSnapshot;

    @Column(name = "custom_attributes_snapshot", columnDefinition = "JSON")
    private String customAttributesSnapshot;

    @Builder.Default
    private Integer quantity = 1;

    @Column(name = "unit_price", precision = 15, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "line_total", precision = 15, scale = 2)
    private BigDecimal lineTotal;
}

package com.oms.module.messenger.entity;

import com.oms.common.base.BaseEntity;
import com.oms.module.product.entity.Product;
import com.oms.module.product.entity.ProductVariant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

import java.math.BigDecimal;

@Entity(name = "MessengerOrderDraftItem")
@Table(
        name = "messenger_order_draft_items",
        indexes = {
                @Index(name = "idx_messenger_order_draft_item_draft_id", columnList = "draft_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderDraftItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "draft_id", nullable = false)
    private OrderDraft draft;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "variant_id")
    private ProductVariant productVariant;

    @Column(name = "product_name", nullable = false, length = 255)
    private String productName;

    @Column(name = "product_code", length = 100)
    private String productCode;

    @Column(name = "sku", length = 100)
    private String sku;

    @Column(name = "variant", length = 150)
    private String variant;

    @Column(name = "quantity", nullable = false)
    @Builder.Default
    private Integer quantity = 1;

    @Column(name = "rental_days")
    private Integer rentalDays;

    @Column(name = "price", precision = 15, scale = 2)
    private BigDecimal price;

    @Column(name = "deposit", precision = 15, scale = 2)
    private BigDecimal deposit;
}

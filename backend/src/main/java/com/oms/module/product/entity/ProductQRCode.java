package com.oms.module.product.entity;

import com.oms.common.base.BaseEntity;
import com.oms.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

/**
 * ProductQRCode - stores history of QR code generation for products.
 */
@Entity
@Table(name = "product_qr_codes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductQRCode extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Column(name = "qr_url", length = 1000, nullable = false)
    private String qrUrl;

    @Column(precision = 15, scale = 2, nullable = false)
    private BigDecimal amount;

    @Column(length = 255)
    private String note;

    @Column(name = "product_name_at_time", length = 200)
    private String productNameAtTime;
}

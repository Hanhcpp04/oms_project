package com.oms.module.product.entity;

import com.oms.common.base.BaseEntity;
import com.oms.module.productform.entity.ProductFormCustomField;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "product_custom_attribute_values")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductCustomAttributeValue extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "field_id")
    private ProductFormCustomField field;

    @Column(name = "field_key_snapshot", length = 100)
    private String fieldKeySnapshot;

    @Column(name = "label_snapshot", length = 150)
    private String labelSnapshot;

    @Column(name = "form_type_snapshot", length = 30)
    private String formTypeSnapshot;

    @Column(name = "value_json", columnDefinition = "JSON")
    private String valueJson;
}

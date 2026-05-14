package com.oms.module.orderform.entity;

import com.oms.common.base.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "order_form_custom_fields")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderFormCustomField extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "config_id", nullable = false, foreignKey = @ForeignKey(name = "FK_ORDER_FIELD_CONFIG"))
    private OrderFormConfig config;

    @Column(name = "field_key", nullable = false, length = 100)
    private String fieldKey;

    @Column(nullable = false, length = 150)
    private String label;

    @Column(name = "field_type", nullable = false, length = 20)
    private String fieldType;

    @Column(name = "is_required", nullable = false)
    @Builder.Default
    private Boolean isRequired = false;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(name = "show_in_order_list", nullable = false)
    @Builder.Default
    private Boolean showInOrderList = false;

    @Column(name = "show_in_order_detail", nullable = false)
    @Builder.Default
    private Boolean showInOrderDetail = true;

    @Column(length = 255)
    private String placeholder;

    @Column(name = "helper_text", length = 255)
    private String helperText;

    @Column(name = "validation_rules_json", columnDefinition = "JSON")
    private String validationRulesJson;

    @OneToMany(mappedBy = "field", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    @Builder.Default
    private List<OrderFormFieldOption> options = new ArrayList<>();
}

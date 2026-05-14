package com.oms.module.formtemplate.entity;

import com.oms.common.base.BaseEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "form_template_fields")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FormTemplateField extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", nullable = false)
    private FormTemplate template;

    @Column(name = "field_key", nullable = false, length = 100)
    private String fieldKey;

    @Column(name = "semantic_key", length = 50)
    private String semanticKey;

    @Column(nullable = false, length = 150)
    private String label;

    @Column(name = "field_type", nullable = false, length = 30)
    private String fieldType;

    @Column(length = 255)
    private String placeholder;

    @Column(name = "helper_text", length = 255)
    private String helperText;

    @Column(name = "default_value", length = 255)
    private String defaultValue;

    @Column(name = "is_required", nullable = false)
    @Builder.Default
    private Boolean isRequired = false;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "show_in_order_list", nullable = false)
    @Builder.Default
    private Boolean showInOrderList = false;

    @Column(name = "show_in_order_detail", nullable = false)
    @Builder.Default
    private Boolean showInOrderDetail = true;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(name = "validation_rules_json", columnDefinition = "JSON")
    private String validationRulesJson;

    @OneToMany(mappedBy = "field", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    @Builder.Default
    private List<FormTemplateFieldOption> options = new ArrayList<>();
}

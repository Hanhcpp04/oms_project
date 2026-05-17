package com.oms.module.formtemplate.entity;

import com.oms.common.base.BaseEntity;
import com.oms.module.shop.entity.Shop;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
@Table(name = "form_templates")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FormTemplate extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_id", nullable = false)
    private Shop shop;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 255)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "form_type", nullable = false, length = 30, columnDefinition = "enum('INTERNAL','ORDER_CAPTURE','PUBLIC')")
    private FormType formType;

    @Enumerated(EnumType.STRING)
    @Column(length = 30, columnDefinition = "enum('general','rent','sell')")
    private FormCategory category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "enum('ARCHIVED','DRAFT','PUBLISHED')")
    @Builder.Default
    private FormStatus status = FormStatus.DRAFT;

    @Column(name = "is_public", nullable = false)
    @Builder.Default
    private Boolean isPublic = false;

    @Column(name = "public_slug", length = 180)
    private String publicSlug;

    @Column(name = "version_no", nullable = false)
    @Builder.Default
    private Integer versionNo = 1;

    @Column(name = "created_by_user_id")
    private Long createdByUserId;

    @OneToMany(mappedBy = "template", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    @Builder.Default
    private List<FormTemplateField> fields = new ArrayList<>();

    public enum FormType {
        PUBLIC, ORDER_CAPTURE, INTERNAL
    }

    public enum FormCategory {
        sell, rent, general
    }

    public enum FormStatus {
        DRAFT, PUBLISHED, ARCHIVED
    }
}

package com.oms.module.order.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Lưu giá trị custom field của đơn hàng theo schema v3.
 * Có đầy đủ snapshot để hiển thị chính xác kể cả sau khi form config thay đổi.
 */
@Entity
@Table(name = "order_custom_field_values")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OrderCustomFieldValue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    // FK nullable — field có thể bị xóa (soft delete) nhưng giá trị vẫn còn
    @Column(name = "field_id")
    private Long fieldId;

    @Column(name = "field_key_snapshot", length = 100, nullable = false)
    private String fieldKeySnapshot;

    @Column(name = "label_snapshot", length = 150, nullable = false)
    private String labelSnapshot;

    @Column(name = "form_type_snapshot", length = 30)
    private String formTypeSnapshot;

    @Column(name = "value_json", columnDefinition = "JSON")
    private String valueJson;

    @Column(name = "show_in_list_snapshot")
    @Builder.Default
    private Boolean showInListSnapshot = false;

    @Column(name = "show_in_detail_snapshot")
    @Builder.Default
    private Boolean showInDetailSnapshot = true;

    @Column(name = "sort_order_snapshot")
    @Builder.Default
    private Integer sortOrderSnapshot = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}

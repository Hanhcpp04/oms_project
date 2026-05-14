package com.oms.module.rental.entity;

import com.oms.common.base.BaseEntity;
import com.oms.module.order.entity.Order;
import com.oms.module.product.entity.ProductVariant;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "rental_availability")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RentalAvailability extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "variant_id", nullable = false)
    private ProductVariant variant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Order order;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "block_type", nullable = false)
    private BlockType blockType;

    @Column(length = 200)
    private String reason;

    @Builder.Default
    @Column(name = "is_active")
    private Boolean isActive = true;

    public enum BlockType {
        CONFIRMED, MANUAL
    }
}

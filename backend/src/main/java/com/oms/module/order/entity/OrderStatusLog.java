package com.oms.module.order.entity;

import com.oms.common.base.BaseEntity;
import com.oms.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "order_status_logs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OrderStatusLog extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column(name = "from_status", length = 20)
    private String fromStatus;

    @Column(name = "to_status", nullable = false, length = 20)
    private String toStatus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by")
    private User changedBy;

    @Column(columnDefinition = "TEXT")
    private String note;
}

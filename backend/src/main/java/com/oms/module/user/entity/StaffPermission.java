package com.oms.module.user.entity;

import com.oms.common.base.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * StaffPermission — links a staff user to a permission, granted by the shop owner.
 * Only relevant for STAFF users. OWNER and ADMIN bypass this table entirely.
 */
@Entity
@Table(name = "staff_permissions",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "permission_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StaffPermission extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "permission_id", nullable = false)
    private Permission permission;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "granted_by", nullable = false)
    private User grantedBy;
}

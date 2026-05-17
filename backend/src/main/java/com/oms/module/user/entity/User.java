package com.oms.module.user.entity;

import com.oms.common.base.BaseEntity;
import com.oms.module.shop.entity.Shop;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * User entity - represents Owner, Staff, or Admin users.
 */
@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_id")
    private Shop shop;

    @Column(length = 150, unique = true, nullable = false)
    private String email;

    @Column(length = 50, unique = true)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Column(length = 20)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", length = 20, nullable = false, columnDefinition = "enum('ADMIN','OWNER','STAFF')")
    private UserRole role;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "last_login")
    private LocalDateTime lastLogin;

    @Column(name = "temporary_password")
    private String temporaryPassword;

    @Column(name = "force_change_password", nullable = false)
    @Builder.Default
    private Boolean forceChangePassword = false;

    public enum UserRole {
        OWNER, STAFF, ADMIN
    }
}

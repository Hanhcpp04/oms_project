package com.oms.module.user.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class StaffDetailResponse {
    private Long id;
    private String fullName;
    private String email;
    private String username;
    private String phone;
    private String role;
    private Boolean isActive;
    private Boolean forceChangePassword;
    private LocalDateTime createdAt;
    private LocalDateTime lastLogin;
    private Integer ordersToday;
    private Integer ordersThisMonth;
}

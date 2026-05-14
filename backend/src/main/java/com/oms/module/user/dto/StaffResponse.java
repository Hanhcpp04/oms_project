package com.oms.module.user.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class StaffResponse {
    private Long id;
    private String fullName;
    private String email;
    private String username;
    private String phone;
    private String temporaryPassword;
    private Boolean forceChangePassword;
}

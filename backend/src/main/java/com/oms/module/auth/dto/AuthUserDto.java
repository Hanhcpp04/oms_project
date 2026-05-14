package com.oms.module.auth.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AuthUserDto {

    private Long id;
    private String fullName;
    private String email;
    private String phone;
    private String role;
    private Boolean forceChangePassword;
}

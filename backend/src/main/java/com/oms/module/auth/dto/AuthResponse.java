package com.oms.module.auth.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AuthResponse {

    private String accessToken;
    private String refreshToken;
    private String tokenType;
    private Long userId;
    private Long shopId;
    private String fullName;
    private String email;
    private String role;
}

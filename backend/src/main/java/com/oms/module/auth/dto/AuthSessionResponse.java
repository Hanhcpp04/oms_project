package com.oms.module.auth.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AuthSessionResponse {

    private String accessToken;
    private String refreshToken;
    private String tokenType;
    private AuthUserDto user;
    private AuthShopDto shop;
    private AuthOnboardingDto onboarding;
}

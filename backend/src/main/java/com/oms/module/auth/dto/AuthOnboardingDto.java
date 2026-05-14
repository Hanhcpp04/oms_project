package com.oms.module.auth.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AuthOnboardingDto {

    private Boolean completed;
    private String currentStep;
}

package com.oms.module.shop.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class ShopSetupStatusResponse {

    private Boolean setupCompleted;
    private Integer progress;
    private Integer completedCount;
    private Integer totalSteps;
    private List<String> completedSteps;
    private List<String> missingSteps;
    private List<StepStatus> steps;

    @Getter
    @Builder
    public static class StepStatus {
        private String key;
        private Boolean completed;
        private Boolean required;
    }
}

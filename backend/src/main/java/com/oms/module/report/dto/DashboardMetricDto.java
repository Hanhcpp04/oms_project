package com.oms.module.report.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardMetricDto {
    private String label;
    private Object value;
    private String trend;
    private String trendDirection; // up, down, neutral
    private String icon;
}

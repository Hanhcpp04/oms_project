package com.oms.module.report.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardRevenueResponse {
    private List<RevenuePointDto> sellRevenue;
    private List<RevenuePointDto> rentRevenue;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RevenuePointDto {
        private String label;
        private java.math.BigDecimal revenue;
        private long orders;
    }
}

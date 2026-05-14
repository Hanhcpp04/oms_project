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
public class DashboardSummaryResponse {
    private List<DashboardMetricDto> metrics;
    private List<RecentOrderDto> recentOrders;
    private List<OrderStatusGroupDto> orderStatusGroups;
    private List<RevenuePointDto> weeklyRevenue;
    private List<EmployeeStatDto> employeeStats;
    private List<GrowthPointDto> growthData;

    /** Aggregates */
    private long totalWeekOrders;
    private long totalWeekRevenue;
}

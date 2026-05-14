package com.oms.module.report.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.module.report.dto.DashboardSummaryResponse;
import com.oms.module.report.service.ReportService;
import com.oms.security.CustomUserDetails;
import com.oms.security.PermissionCode;
import com.oms.security.RequirePermission;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
@Tag(name = "Reports", description = "Reporting and Analytics")
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/dashboard/summary")
    @Operation(summary = "Get full dashboard summary: KPIs, recent orders, order status, weekly revenue, employee stats, growth data")
    @RequirePermission(PermissionCode.REPORT_REVENUE)
    public ResponseEntity<ApiResponse<DashboardSummaryResponse>> getDashboardSummary(
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(reportService.getSummary(user.getShopId())));
    }
}

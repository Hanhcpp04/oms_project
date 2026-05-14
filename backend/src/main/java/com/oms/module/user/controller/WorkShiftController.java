package com.oms.module.user.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.module.user.dto.shift.CreateWorkShiftRequest;
import com.oms.module.user.dto.shift.UpdateWorkShiftRequest;
import com.oms.module.user.dto.shift.WorkShiftResponse;
import com.oms.module.user.service.WorkShiftService;
import com.oms.security.CustomUserDetails;
import com.oms.security.PermissionCode;
import com.oms.security.RequirePermission;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/staff/shifts")
@RequiredArgsConstructor
@Tag(name = "Work Shift Management", description = "Endpoints for managing staff work shifts")
public class WorkShiftController {

    private final WorkShiftService workShiftService;

    @PostMapping
    @Operation(summary = "Create a new work shift")
    @RequirePermission(PermissionCode.STAFF_SCHEDULE_MANAGE)
    public ResponseEntity<ApiResponse<WorkShiftResponse>> createShift(
            @Valid @RequestBody CreateWorkShiftRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        WorkShiftResponse response = workShiftService.createShift(userDetails.getUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created("Khung giờ làm việc đã được tạo", response));
    }

    @PutMapping("/{shiftId}")
    @Operation(summary = "Update an existing work shift")
    @RequirePermission(PermissionCode.STAFF_SCHEDULE_MANAGE)
    public ResponseEntity<ApiResponse<WorkShiftResponse>> updateShift(
            @PathVariable Long shiftId,
            @Valid @RequestBody UpdateWorkShiftRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        WorkShiftResponse response = workShiftService.updateShift(userDetails.getUserId(), shiftId, request);
        return ResponseEntity.ok(ApiResponse.ok("Cập nhật khung giờ làm việc thành công", response));
    }

    @DeleteMapping("/{shiftId}")
    @Operation(summary = "Delete a work shift")
    @RequirePermission(PermissionCode.STAFF_SCHEDULE_MANAGE)
    public ResponseEntity<ApiResponse<Void>> deleteShift(
            @PathVariable Long shiftId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        workShiftService.deleteShift(userDetails.getUserId(), shiftId);
        return ResponseEntity.ok(ApiResponse.ok("Đã xóa khung giờ làm việc", null));
    }

    @GetMapping
    @Operation(summary = "Get shifts for a specific date range. STAFF sees only own shifts, OWNER sees all.")
    @RequirePermission(PermissionCode.STAFF_SCHEDULE_VIEW_OWN)
    public ResponseEntity<ApiResponse<List<WorkShiftResponse>>> getShifts(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        List<WorkShiftResponse> response = workShiftService.getShiftsByDateRange(
                userDetails.getUserId(), userDetails.getRole(), startDate, endDate);
        return ResponseEntity.ok(ApiResponse.ok("Lấy danh sách lịch làm việc thành công", response));
    }
}

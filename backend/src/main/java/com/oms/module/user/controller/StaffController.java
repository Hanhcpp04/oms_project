package com.oms.module.user.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.common.dto.PageResponse;
import com.oms.module.user.dto.CreateStaffRequest;
import com.oms.module.user.dto.StaffDetailResponse;
import com.oms.module.user.dto.StaffListResponse;
import com.oms.module.user.dto.StaffResponse;
import com.oms.module.user.service.StaffService;
import com.oms.security.CustomUserDetails;
import com.oms.security.PermissionCode;
import com.oms.security.RequirePermission;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
@Tag(name = "Staff Management", description = "Endpoints for managing staff members")
public class StaffController {

    private final StaffService staffService;

    @PostMapping
    @Operation(summary = "Create a new staff member")
    @RequirePermission(PermissionCode.STAFF_MANAGE)
    public ResponseEntity<ApiResponse<StaffResponse>> createStaff(
            @Valid @RequestBody CreateStaffRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        StaffResponse response = staffService.createStaff(userDetails.getUserId(), request);
        
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created("Staff created successfully", response));
    }

    @GetMapping
    @Operation(summary = "Get list of staff members")
    @RequirePermission(PermissionCode.STAFF_MANAGE)
    public ResponseEntity<ApiResponse<PageResponse<StaffListResponse>>> listStaff(
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20) Pageable pageable,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        PageResponse<StaffListResponse> response = staffService.getStaffList(userDetails.getUserId(), search, pageable);
        
        return ResponseEntity.ok(ApiResponse.ok("Staff list retrieved", response));
    }

    @GetMapping("/{staffId}")
    @Operation(summary = "Get staff member detail")
    @RequirePermission(PermissionCode.STAFF_MANAGE)
    public ResponseEntity<ApiResponse<StaffDetailResponse>> getStaffDetail(
            @PathVariable Long staffId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        StaffDetailResponse response = staffService.getStaffDetail(userDetails.getUserId(), staffId);

        return ResponseEntity.ok(ApiResponse.ok("Staff detail retrieved", response));
    }
}

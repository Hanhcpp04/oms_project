package com.oms.module.user.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.module.user.dto.PermissionResponse;
import com.oms.module.user.dto.UpdatePermissionsRequest;
import com.oms.module.user.entity.Permission;
import com.oms.module.user.service.PermissionService;
import com.oms.security.CustomUserDetails;
import com.oms.security.PermissionCode;
import com.oms.security.RequirePermission;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/staff/{staffId}/permissions")
@RequiredArgsConstructor
@Tag(name = "Staff Permissions", description = "Manage permissions for staff members")
public class StaffPermissionController {

    private final PermissionService permissionService;

    @GetMapping
    @Operation(summary = "Get all permissions with grant status for a specific staff member")
    public ResponseEntity<ApiResponse<List<PermissionResponse>>> getStaffPermissions(
                        @PathVariable Long staffId,
                        @AuthenticationPrincipal CustomUserDetails userDetails) {

                boolean isSelf = userDetails != null && userDetails.getUserId().equals(staffId);
                boolean hasManagePermission = userDetails != null && permissionService.hasPermission(userDetails.getUserId(), PermissionCode.STAFF_MANAGE);

                if (!isSelf && !hasManagePermission) {
                        throw new com.oms.common.exception.BusinessException(
                                        com.oms.common.exception.ErrorCode.FORBIDDEN,
                                        "Bạn không có quyền thực hiện hành động này: " + PermissionCode.STAFF_MANAGE.getDisplayName());
                }

        List<Permission> allPermissions = permissionService.getAllPermissions();
        List<String> grantedCodes = permissionService.getStaffPermissionCodes(staffId);
        Set<String> grantedSet = Set.copyOf(grantedCodes);

        List<PermissionResponse> response = allPermissions.stream()
                .map(p -> PermissionResponse.builder()
                        .id(p.getId())
                        .code(p.getCode())
                        .name(p.getName())
                        .category(p.getCategory())
                        .description(p.getDescription())
                        .granted(grantedSet.contains(p.getCode()))
                        .build())
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.ok("Staff permissions retrieved", response));
    }

    @PutMapping
    @Operation(summary = "Update all permissions for a staff member")
    @RequirePermission(PermissionCode.STAFF_MANAGE)
    public ResponseEntity<ApiResponse<List<String>>> updateStaffPermissions(
            @PathVariable Long staffId,
            @RequestBody UpdatePermissionsRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        List<String> updatedCodes = permissionService.updateStaffPermissions(
                userDetails.getUserId(), staffId, request.getPermissionCodes());

        return ResponseEntity.ok(ApiResponse.ok("Permissions updated successfully", updatedCodes));
    }
}

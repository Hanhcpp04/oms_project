package com.oms.module.shop.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.module.auth.dto.AuthSessionResponse;
import com.oms.module.shop.dto.ShopCategoriesRequest;
import com.oms.module.shop.dto.ShopOperationalSettingsRequest;
import com.oms.module.shop.dto.ShopSetupStatusResponse;
import com.oms.module.shop.dto.UpdateShopProfileRequest;
import com.oms.module.shop.service.ShopService;
import com.oms.security.CustomUserDetails;
import com.oms.security.PermissionCode;
import com.oms.security.RequirePermission;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/shops")
@RequiredArgsConstructor
public class ShopController {

    private final ShopService shopService;

    @GetMapping("/me/setup-status")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ApiResponse<ShopSetupStatusResponse> getSetupStatus(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        ShopSetupStatusResponse status = shopService.getSetupStatus(userDetails.getUserId());
        return ApiResponse.ok("Shop setup status fetched successfully", status);
    }

    @PostMapping("/basic-info")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ApiResponse<AuthSessionResponse> updateBasicInfo(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody UpdateShopProfileRequest request) {
        AuthSessionResponse session = shopService.updateBasicInfo(
                userDetails.getUserId(),
                request.getName(),
                request.getEmail(),
                request.getPhone());
        return ApiResponse.ok("Basic info updated successfully", session);
    }

    @PostMapping("/support-info")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ApiResponse<AuthSessionResponse> updateSupportInfo(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody UpdateShopProfileRequest request) {
        AuthSessionResponse session = shopService.updateSupportInfo(
                userDetails.getUserId(),
                request.getSupportEmail(),
                request.getSupportPhone());
        return ApiResponse.ok("Support info updated successfully", session);
    }

    @PostMapping("/logo")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ApiResponse<AuthSessionResponse> updateLogo(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody UpdateShopProfileRequest request) {
        AuthSessionResponse session = shopService.updateLogo(userDetails.getUserId(), request.getLogoUrl());
        return ApiResponse.ok("Logo updated successfully", session);
    }

    @PostMapping("/addresses/bulk")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ApiResponse<AuthSessionResponse> updateAddresses(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody UpdateShopProfileRequest request) {
        AuthSessionResponse session = shopService.updateAddresses(userDetails.getUserId(), request.getAddresses());
        return ApiResponse.ok("Addresses updated successfully", session);
    }

    @PostMapping("/settings")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ApiResponse<AuthSessionResponse> updateSettings(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody ShopOperationalSettingsRequest request) {
        AuthSessionResponse session = shopService.updateOperationalSettings(userDetails.getUserId(), request);
        return ApiResponse.ok("Operational settings updated successfully", session);
    }

    @PostMapping("/categories")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ApiResponse<AuthSessionResponse> updateCategories(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody ShopCategoriesRequest request) {
        AuthSessionResponse session = shopService.updateCategoriesSettings(userDetails.getUserId(), request);
        return ApiResponse.ok("Categories updated successfully", session);
    }
}

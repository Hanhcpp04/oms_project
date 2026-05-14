package com.oms.module.shop.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.module.auth.dto.AuthSessionResponse;
import com.oms.module.shop.dto.ShopBusinessTypeRequest;
import com.oms.module.shop.dto.ShopCategoriesRequest;
import com.oms.module.shop.dto.ShopProfileRequest;
import com.oms.module.shop.service.ShopService;
import com.oms.security.CustomUserDetails;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/shops/onboarding")
@RequiredArgsConstructor
@Tag(name = "Shop Onboarding", description = "Shop creation and setup flow")
public class ShopOnboardingController {

    private final ShopService shopService;

    @PostMapping("/profile")
    @Operation(summary = "Create initial shop profile (Step 1 of Onboarding)")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> createShopProfile(
            @Valid @RequestBody ShopProfileRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        AuthSessionResponse response = shopService.createShopForOwner(userDetails.getUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created("Shop created successfully", response));
    }

    @PostMapping("/business-type")
    @Operation(summary = "Set shop business type (Step 2 of Onboarding)")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> updateBusinessType(
            @Valid @RequestBody ShopBusinessTypeRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        AuthSessionResponse response = shopService.updateBusinessType(userDetails.getUserId(), request);
        return ResponseEntity.ok(ApiResponse.ok("Business type updated successfully", response));
    }

    @PostMapping("/categories")
    @Operation(summary = "Set shop categories (Step 3 of Onboarding)")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> saveCategories(
            @Valid @RequestBody ShopCategoriesRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        AuthSessionResponse response = shopService.saveCategories(userDetails.getUserId(), request);
        return ResponseEntity.ok(ApiResponse.ok("Categories saved successfully", response));
    }

    @PostMapping("/complete")
    @Operation(summary = "Complete onboarding process")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> completeOnboarding(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        AuthSessionResponse response = shopService.completeOnboarding(userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok("Onboarding completed successfully", response));
    }
}

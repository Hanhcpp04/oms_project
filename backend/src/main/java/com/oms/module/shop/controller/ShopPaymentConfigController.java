package com.oms.module.shop.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.security.CustomUserDetails;
import com.oms.module.shop.dto.PaymentConfigDto;
import com.oms.module.shop.service.ShopPaymentConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import com.oms.security.PermissionCode;
import com.oms.security.RequirePermission;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/shops/payment-config")
@RequiredArgsConstructor
@Tag(name = "Shop Payment Config", description = "Endpoints for managing shop payment methods configuration")
public class ShopPaymentConfigController {

    private final ShopPaymentConfigService paymentConfigService;

    @GetMapping
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    @Operation(summary = "Get payment configuration for current shop")
    public ResponseEntity<ApiResponse<PaymentConfigDto>> getConfig(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        PaymentConfigDto dto = paymentConfigService.getByShopId(userDetails.getShopId());
        return ResponseEntity.ok(ApiResponse.ok(dto));
    }

    @PutMapping
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    @Operation(summary = "Save (create or update) payment configuration for current shop")
    public ResponseEntity<ApiResponse<PaymentConfigDto>> saveConfig(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody PaymentConfigDto dto) {
        PaymentConfigDto saved = paymentConfigService.save(userDetails.getShopId(), dto);
        return ResponseEntity.ok(ApiResponse.ok(saved));
    }
}

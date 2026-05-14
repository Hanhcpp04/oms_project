package com.oms.module.shop.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.security.CustomUserDetails;
import com.oms.module.shop.dto.ShippingMethodDto;
import com.oms.module.shop.service.ShopShippingMethodService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import com.oms.security.PermissionCode;
import com.oms.security.RequirePermission;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/shops/shipping-methods")
@RequiredArgsConstructor
@Tag(name = "Shop Shipping Methods", description = "Endpoints for managing shop shipping methods")
public class ShopShippingMethodController {

    private final ShopShippingMethodService shippingMethodService;

    @GetMapping
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    @Operation(summary = "Get all shipping methods for current shop")
    public ResponseEntity<ApiResponse<List<ShippingMethodDto>>> getAllMethods(@AuthenticationPrincipal CustomUserDetails userDetails) {
        Long shopId = userDetails.getShopId();
        List<ShippingMethodDto> methods = shippingMethodService.getAllByShopId(shopId);
        return ResponseEntity.ok(ApiResponse.ok(methods));
    }

    @PostMapping
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    @Operation(summary = "Create a new shipping method")
    public ResponseEntity<ApiResponse<ShippingMethodDto>> createMethod(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody ShippingMethodDto dto) {
        Long shopId = userDetails.getShopId();
        ShippingMethodDto created = shippingMethodService.create(shopId, dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(created));
    }

    @PutMapping("/{id}")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    @Operation(summary = "Update an existing shipping method")
    public ResponseEntity<ApiResponse<ShippingMethodDto>> updateMethod(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id,
            @Valid @RequestBody ShippingMethodDto dto) {
        Long shopId = userDetails.getShopId();
        ShippingMethodDto updated = shippingMethodService.update(shopId, id, dto);
        return ResponseEntity.ok(ApiResponse.ok(updated));
    }

    @DeleteMapping("/{id}")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    @Operation(summary = "Delete a shipping method")
    public ResponseEntity<ApiResponse<Void>> deleteMethod(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id) {
        Long shopId = userDetails.getShopId();
        shippingMethodService.delete(shopId, id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}

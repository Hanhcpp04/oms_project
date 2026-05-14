package com.oms.module.shop.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.module.shop.dto.CreateShopAddressRequest;
import com.oms.module.shop.dto.ShopAddressResponse;
import com.oms.module.shop.dto.UpdateShopAddressRequest;
import com.oms.module.shop.entity.ShopAddress;
import com.oms.module.shop.service.ShopService;
import com.oms.security.CustomUserDetails;
import com.oms.security.PermissionCode;
import com.oms.security.RequirePermission;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/shops/addresses")
@RequiredArgsConstructor
public class AddressController {

    private final ShopService shopService;

    @GetMapping
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ApiResponse<List<ShopAddressResponse>> getAddresses(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        List<ShopAddressResponse> responses = shopService.getAddresses(userDetails.getUserId()).stream()
                .map(this::mapToResponse)
                .toList();
        return ApiResponse.ok("Addresses fetched successfully", responses);
    }

    @PostMapping
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ShopAddressResponse> createAddress(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody CreateShopAddressRequest request) {
        ShopAddress address = shopService.createAddress(userDetails.getUserId(), request);
        return ApiResponse.ok("Address created successfully", mapToResponse(address));
    }

    @PutMapping("/{id}")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ApiResponse<ShopAddressResponse> updateAddress(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id,
            @Valid @RequestBody UpdateShopAddressRequest request) {
        ShopAddress address = shopService.updateAddress(userDetails.getUserId(), id, request);
        return ApiResponse.ok("Address updated successfully", mapToResponse(address));
    }

    @DeleteMapping("/{id}")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ApiResponse<Void> deleteAddress(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id) {
        shopService.deleteAddress(userDetails.getUserId(), id);
        return ApiResponse.ok("Address deleted successfully", null);
    }

    @PatchMapping("/{id}/default")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ApiResponse<ShopAddressResponse> setDefaultAddress(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id) {
        ShopAddress address = shopService.setDefaultAddress(userDetails.getUserId(), id);
        return ApiResponse.ok("Default address updated successfully", mapToResponse(address));
    }

    private ShopAddressResponse mapToResponse(ShopAddress address) {
        return ShopAddressResponse.builder()
                .id(address.getId())
                .label(address.getLabel())
                .addressLine(address.getAddressLine())
                .ward(address.getWard())
                .district(address.getDistrict())
                .province(address.getProvince())
                .isDefault(address.getIsDefault())
                .createdAt(address.getCreatedAt())
                .updatedAt(address.getUpdatedAt())
                .build();
    }
}

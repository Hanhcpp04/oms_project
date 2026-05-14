package com.oms.module.shop.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.security.PermissionCode;
import com.oms.security.RequirePermission;
import com.oms.security.CustomUserDetails;
import com.oms.module.shop.dto.OrderSourceDto;
import com.oms.module.shop.service.ShopOrderSourceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/shops/order-sources")
@RequiredArgsConstructor
@Tag(name = "Shop Order Source", description = "Quản lý nguồn đơn hàng của shop")
public class ShopOrderSourceController {

    private final ShopOrderSourceService orderSourceService;

    @GetMapping
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    @Operation(summary = "Lấy danh sách nguồn đơn hàng của shop")
    public ResponseEntity<ApiResponse<List<OrderSourceDto>>> getAll(
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(orderSourceService.getAllByShopId(user.getShopId())));
    }

    @PostMapping
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    @Operation(summary = "Tạo mới nguồn đơn hàng")
    public ResponseEntity<ApiResponse<OrderSourceDto>> create(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestBody OrderSourceDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(orderSourceService.create(user.getShopId(), dto)));
    }

    @PutMapping("/{id}")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    @Operation(summary = "Cập nhật nguồn đơn hàng")
    public ResponseEntity<ApiResponse<OrderSourceDto>> update(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @RequestBody OrderSourceDto dto) {
        return ResponseEntity.ok(ApiResponse.ok(orderSourceService.update(user.getShopId(), id, dto)));
    }

    @DeleteMapping("/{id}")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    @Operation(summary = "Xoá nguồn đơn hàng")
    public ResponseEntity<ApiResponse<Void>> delete(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id) {
        orderSourceService.delete(user.getShopId(), id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}

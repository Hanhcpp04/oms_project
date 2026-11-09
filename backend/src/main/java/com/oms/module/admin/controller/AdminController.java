package com.oms.module.admin.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.common.dto.PageResponse;
import com.oms.module.shop.entity.Shop;
import com.oms.module.admin.entity.AuditEvent;
import com.oms.module.admin.repository.AuditEventRepository;
import com.oms.module.shop.repository.ShopRepository;
import com.oms.module.user.entity.User;
import com.oms.module.user.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Admin controller — platform-level management.
 * All endpoints under /api/admin/** are protected by hasRole("ADMIN") in SecurityConfig.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Tag(name = "Admin", description = "Platform administration endpoints")
public class AdminController {

    private final ShopRepository shopRepository;
    private final UserRepository userRepository;
    private final AuditEventRepository auditEventRepository;

    @GetMapping("/audit-events")
    @Operation(summary = "List recent authenticated mutation audit events")
    public ResponseEntity<ApiResponse<PageResponse<AuditEvent>>> listAuditEvents(
            @PageableDefault(size = 50) Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.ok("Audit events",
                PageResponse.of(auditEventRepository.findAllByOrderByOccurredAtDesc(pageable))));
    }

    @GetMapping("/shops")
    @Operation(summary = "List all shops on the platform")
    public ResponseEntity<ApiResponse<PageResponse<Shop>>> listShops(
            @PageableDefault(size = 20) Pageable pageable) {
        Page<Shop> page = shopRepository.findAll(pageable);
        return ResponseEntity.ok(ApiResponse.ok("Shops list",
                PageResponse.of(page)));
    }

    @PatchMapping("/shops/{shopId}/status")
    @Operation(summary = "Update shop status (ACTIVE, SUSPENDED, PENDING)")
    public ResponseEntity<ApiResponse<Void>> updateShopStatus(
            @PathVariable Long shopId,
            @RequestParam Shop.ShopStatus status) {
        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new RuntimeException("Shop not found"));
        shop.setStatus(status);
        shopRepository.save(shop);
        return ResponseEntity.ok(ApiResponse.ok("Shop status updated", null));
    }

    @GetMapping("/users")
    @Operation(summary = "List all users on the platform")
    public ResponseEntity<ApiResponse<PageResponse<User>>> listUsers(
            @PageableDefault(size = 20) Pageable pageable) {
        Page<User> page = userRepository.findAll(pageable);
        return ResponseEntity.ok(ApiResponse.ok("Users list",
                PageResponse.of(page)));
    }
}

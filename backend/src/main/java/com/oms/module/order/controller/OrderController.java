package com.oms.module.order.controller;

import com.oms.common.constant.AppConstants;
import com.oms.common.dto.ApiResponse;
import com.oms.common.dto.PageResponse;
import com.oms.module.order.dto.AiParseRequest;
import com.oms.module.order.dto.AiParseResponse;
import com.oms.module.order.dto.OrderRequest;
import com.oms.module.order.dto.OrderResponse;
import com.oms.module.order.entity.Order;
import com.oms.module.order.service.OrderAiParseService;
import com.oms.module.order.service.OrderService;
import com.oms.security.CustomUserDetails;
import com.oms.security.PermissionCode;
import com.oms.security.RequirePermission;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
@Tag(name = "Orders", description = "Order management")
public class OrderController {

    private final OrderService orderService;
    private final OrderAiParseService orderAiParseService;

    @GetMapping
    @Operation(summary = "Search orders with filters")
    @RequirePermission(PermissionCode.ORDER_VIEW)
    public ResponseEntity<ApiResponse<PageResponse<OrderResponse>>> getOrders(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam(required = false) Order.OrderStatus status,
            @RequestParam(required = false) Order.OrderType type,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false)
            @org.springframework.format.annotation.DateTimeFormat(
                    iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME
            ) java.time.LocalDateTime fromDate,
            @RequestParam(required = false)
            @org.springframework.format.annotation.DateTimeFormat(
                    iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME
            ) java.time.LocalDateTime toDate,
            @RequestParam(defaultValue = AppConstants.DEFAULT_PAGE_NUMBER) int page,
            @RequestParam(defaultValue = AppConstants.DEFAULT_PAGE_SIZE) int size) {

        var pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        var result = orderService.getOrders(user.getShopId(), status, type, fromDate, toDate, keyword, pageable);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get order detail")
    @RequirePermission(PermissionCode.ORDER_VIEW)
    public ResponseEntity<ApiResponse<OrderResponse>> getOrder(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(orderService.getOrder(user.getShopId(), id)));
    }

    @PostMapping
    @Operation(summary = "Create new order")
    @RequirePermission(PermissionCode.ORDER_CREATE)
    public ResponseEntity<ApiResponse<OrderResponse>> createOrder(
            @AuthenticationPrincipal CustomUserDetails user,
            @Valid @RequestBody OrderRequest request) {
        var result = orderService.createOrder(user.getShopId(), request, user.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(result));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Update order status")
    @RequirePermission(PermissionCode.ORDER_UPDATE_STATUS)
    public ResponseEntity<ApiResponse<OrderResponse>> updateStatus(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @RequestParam Order.OrderStatus status) {
        var result = orderService.updateStatus(user.getShopId(), id, status, user.getUserId());
        return ResponseEntity.ok(ApiResponse.ok("Status updated", result));
    }

    @PostMapping("/ai-parse")
    @Operation(summary = "Parse order text using AI")
    @RequirePermission(PermissionCode.ORDER_CREATE)
    public ResponseEntity<ApiResponse<AiParseResponse>> parseOrderText(
            @AuthenticationPrincipal CustomUserDetails user,
            @Valid @RequestBody AiParseRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(orderAiParseService.parse(user.getShopId(), request)));
    }
}

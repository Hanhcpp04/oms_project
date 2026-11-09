package com.oms.module.notification.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.common.dto.PageResponse;
import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.module.notification.dto.NotificationResponse;
import com.oms.module.notification.service.NotificationRealtimeService;
import com.oms.module.notification.service.NotificationService;
import com.oms.security.CustomUserDetails;
import com.oms.security.PermissionCode;
import com.oms.security.RequirePermission;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Tag(name = "Notifications", description = "In-app notification endpoints")
public class NotificationController {

    private final NotificationService notificationService;
    private final NotificationRealtimeService notificationRealtimeService;

    @GetMapping
    @Operation(summary = "List notifications for current shop")
    @RequirePermission(PermissionCode.ORDER_VIEW)
    public ResponseEntity<ApiResponse<PageResponse<NotificationResponse>>> getNotifications(
            @AuthenticationPrincipal CustomUserDetails user,
            Pageable pageable) {
        Long shopId = requireShopId(user);
        return ResponseEntity.ok(ApiResponse.ok(notificationService.getNotifications(shopId, pageable)));
    }

    @GetMapping("/unread-count")
    @Operation(summary = "Count unread notifications for current shop")
    @RequirePermission(PermissionCode.ORDER_VIEW)
    public ResponseEntity<ApiResponse<Map<String, Long>>> countUnread(
            @AuthenticationPrincipal CustomUserDetails user) {
        Long shopId = requireShopId(user);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("count", notificationService.countUnread(shopId))));
    }

    @PatchMapping("/{id}/read")
    @Operation(summary = "Mark one notification as read")
    @RequirePermission(PermissionCode.ORDER_VIEW)
    public ResponseEntity<ApiResponse<NotificationResponse>> markRead(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id) {
        Long shopId = requireShopId(user);
        return ResponseEntity.ok(ApiResponse.ok(notificationService.markRead(shopId, id)));
    }

    @PatchMapping("/read-all")
    @Operation(summary = "Mark all notifications as read")
    @RequirePermission(PermissionCode.ORDER_VIEW)
    public ResponseEntity<ApiResponse<Map<String, Long>>> markAllRead(
            @AuthenticationPrincipal CustomUserDetails user) {
        Long shopId = requireShopId(user);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("updated", notificationService.markAllRead(shopId))));
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Stream realtime notifications for current shop")
    @RequirePermission(PermissionCode.ORDER_VIEW)
    public SseEmitter stream(@AuthenticationPrincipal CustomUserDetails user) {
        return notificationRealtimeService.subscribe(requireShopId(user));
    }

    private Long requireShopId(CustomUserDetails user) {
        if (user == null || user.getShopId() == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Notification access requires a shop context");
        }

        return user.getShopId();
    }
}

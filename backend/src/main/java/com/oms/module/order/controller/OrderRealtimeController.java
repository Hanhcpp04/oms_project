package com.oms.module.order.controller;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.module.order.service.OrderRealtimeService;
import com.oms.security.CustomUserDetails;
import com.oms.security.PermissionCode;
import com.oms.security.RequirePermission;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/orders/realtime")
@RequiredArgsConstructor
public class OrderRealtimeController {

    private final OrderRealtimeService orderRealtimeService;

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Stream realtime order events for current shop")
    @RequirePermission(PermissionCode.ORDER_VIEW)
    public SseEmitter stream(@AuthenticationPrincipal CustomUserDetails user) {
        if (user == null || user.getShopId() == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Realtime order stream requires a shop context");
        }

        return orderRealtimeService.subscribe(user.getShopId());
    }
}

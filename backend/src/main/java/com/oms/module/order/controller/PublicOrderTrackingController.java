package com.oms.module.order.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.module.order.dto.PublicOrderTrackingResponse;
import com.oms.module.order.service.PublicOrderTrackingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/orders")
@RequiredArgsConstructor
@Tag(name = "Public Order Tracking", description = "Public order tracking endpoints")
public class PublicOrderTrackingController {

    private final PublicOrderTrackingService trackingService;

    @GetMapping("/track/{token}")
    @Operation(summary = "Get public order tracking detail")
    public ResponseEntity<ApiResponse<PublicOrderTrackingResponse>> getOrderTracking(
            @PathVariable String token) {
        return ResponseEntity.ok(ApiResponse.ok(trackingService.getByToken(token)));
    }
}

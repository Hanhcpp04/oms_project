package com.oms.module.payment.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.module.payment.dto.PaymentCheckoutResponse;
import com.oms.module.payment.payos.PayosWebhookRequest;
import com.oms.module.payment.service.PaymentService;
import com.oms.security.CustomUserDetails;
import com.oms.security.PermissionCode;
import com.oms.security.RequirePermission;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
@Tag(name = "Payments", description = "Payment checkout and webhook endpoints")
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/orders/{orderId}/payos")
    @Operation(summary = "Create payOS checkout for an order")
    @RequirePermission(PermissionCode.ORDER_UPDATE_STATUS)
    public ResponseEntity<ApiResponse<PaymentCheckoutResponse>> createPayosCheckout(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long orderId) {
        return ResponseEntity.ok(ApiResponse.ok(paymentService.createPayosCheckout(user.getShopId(), orderId)));
    }

    @PostMapping("/payos/webhook")
    @Operation(summary = "Receive payOS payment webhook")
    public ResponseEntity<ApiResponse<String>> handlePayosWebhook(@RequestBody PayosWebhookRequest request) {
        paymentService.handlePayosWebhook(request);
        return ResponseEntity.ok(ApiResponse.ok("OK"));
    }
}

package com.oms.module.payment.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class PaymentCheckoutResponse {

    private Long paymentId;
    private String provider;
    private String method;
    private String purpose;
    private String status;
    private Long providerOrderCode;
    private String providerPaymentLinkId;
    private BigDecimal amount;
    private String currency;
    private String description;
    private String checkoutUrl;
    private String qrCode;
    private String qrImageUrl;
}

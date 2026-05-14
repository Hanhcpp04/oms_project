package com.oms.module.shop.dto;

import lombok.Data;

/**
 * DTO for shop payment configuration (GET and PUT).
 */
@Data
public class PaymentConfigDto {

    // COD
    private boolean codEnabled;

    // Bank Transfer
    private boolean bankTransferEnabled;
    private String bankName;
    private String bankCode;
    private String bankAccountNumber;
    private String bankAccountName;

    // VNPay (direction only — future integration)
    private boolean vnpayEnabled;
    private String vnpayTmnCode;
    private String vnpayHashSecret;
}

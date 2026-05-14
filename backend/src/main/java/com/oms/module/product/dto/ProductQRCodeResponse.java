package com.oms.module.product.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class ProductQRCodeResponse {
    private Long id;
    private String qrUrl;
    private BigDecimal amount;
    private String note;
    private String productNameAtTime;
    private String createdByFullName;
    private LocalDateTime createdAt;
}

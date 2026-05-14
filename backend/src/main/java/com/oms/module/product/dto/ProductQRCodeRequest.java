package com.oms.module.product.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class ProductQRCodeRequest {
    @NotNull(message = "Amount is required")
    private BigDecimal amount;
    
    private String note;
}

package com.oms.module.shop.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ShopBusinessTypeRequest {
    @NotNull(message = "enableSell is required")
    private Boolean enableSell;

    @NotNull(message = "enableRent is required")
    private Boolean enableRent;
}

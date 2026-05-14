package com.oms.module.shop.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ShopProfileRequest {

    @NotBlank(message = "Shop name is required")
    private String shopName;

    private String email;

    private String phone;

    private String logoUrl;
}

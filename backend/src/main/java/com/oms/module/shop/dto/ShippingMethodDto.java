package com.oms.module.shop.dto;

import com.oms.module.shop.entity.ShopShippingMethod;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ShippingMethodDto {
    private Long id;

    @NotBlank(message = "Tên phương thức vận chuyển không được để trống")
    private String name;

    @NotNull(message = "Chính sách phí không được để trống")
    private ShopShippingMethod.FeePolicy feePolicy;

    private BigDecimal defaultFee;

    private boolean active = true;
}

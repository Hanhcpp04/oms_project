package com.oms.module.order.dto;

import com.oms.module.order.entity.Order;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AiParseRequest {

    @NotBlank(message = "Raw text is required")
    private String rawText;

    private Order.OrderType orderTypeHint;
}

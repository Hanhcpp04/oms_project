package com.oms.module.payment.payos;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PayosCreatePaymentRequest {

    private Long orderCode;
    private Long amount;
    private String description;
    private String buyerName;
    private String buyerPhone;
    private List<Item> items;
    private String cancelUrl;
    private String returnUrl;
    private Integer expiredAt;
    private String signature;

    @Getter
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Item {
        private String name;
        private Integer quantity;
        private Long price;
    }
}

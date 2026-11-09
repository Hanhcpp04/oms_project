package com.oms.module.order.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.oms.module.order.entity.Order;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AiParseResponse {

    private Order.OrderType orderType;
    private String customerName;
    private String customerPhone;
    private String customerAddress;
    private String customerNote;
    private String sourceChannel;
    private String shippingMethod;
    private BigDecimal shippingFee;
    private String rentFrom;
    private String rentTo;
    private BigDecimal depositPaid;
    private List<ProductDraft> products;
    private Map<String, Object> customFields;

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ProductDraft {
        private Long productId;
        private Long variantId;
        private String productCode;
        private String sku;
        private String name;
        private String size;
        private String color;
        private Integer quantity;
        private BigDecimal unitPrice;
    }
}

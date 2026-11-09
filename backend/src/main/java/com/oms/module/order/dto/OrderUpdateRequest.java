package com.oms.module.order.dto;

import com.oms.module.order.entity.Order;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class OrderUpdateRequest {
    private String customerName;
    private String customerPhone;
    private String customerAddress;
    private String customerNote;
    private String sourceChannel;
    private String shippingMethod;
    private BigDecimal shippingFee;
    private Order.PaymentStatus paymentStatus;
    private Order.PaymentMethod paymentMethod;
}

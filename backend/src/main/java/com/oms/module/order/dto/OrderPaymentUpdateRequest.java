package com.oms.module.order.dto;

import com.oms.module.order.entity.Order;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class OrderPaymentUpdateRequest {
    private Order.PaymentStatus paymentStatus;
    private Order.PaymentMethod paymentMethod;
}

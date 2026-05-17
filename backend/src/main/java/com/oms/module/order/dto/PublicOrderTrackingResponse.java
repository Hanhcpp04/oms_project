package com.oms.module.order.dto;

import com.oms.module.order.entity.Order;
import com.oms.module.payment.dto.PaymentCheckoutResponse;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class PublicOrderTrackingResponse {

    private String orderCode;
    private Order.OrderType orderType;
    private Order.OrderStatus status;
    private Order.PaymentStatus paymentStatus;
    private Order.PaymentMethod paymentMethod;

    private String shopName;
    private String shopLogoUrl;

    private String customerName;
    private String customerPhone;
    private String customerAddress;
    private String customerNote;

    private String shippingMethod;
    private BigDecimal shippingFee;
    private BigDecimal totalAmount;
    private BigDecimal depositAmount;
    private LocalDate rentFrom;
    private LocalDate rentTo;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private List<ItemResponse> items;
    private PaymentCheckoutResponse payment;

    @Getter
    @Builder
    public static class ItemResponse {
        private String productName;
        private String productImageUrl;
        private String sku;
        private String size;
        private String color;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal lineTotal;
    }
}

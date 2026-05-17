package com.oms.module.messenger.dto;

import com.oms.module.order.entity.Order;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Getter
@Builder
public class OrderInfoExtractedDto {

    private String customerName;
    private String phone;
    private String address;
    private Order.OrderType orderType;
    private Long productId;
    private Long variantId;
    private String productName;
    private String productCode;
    private String sku;
    private Integer quantity;
    private String color;
    private String size;
    private BigDecimal price;
    private BigDecimal depositAmount;
    private Integer rentalDays;
    private LocalDate deliveryDate;
    private LocalDate rentFrom;
    private LocalDate rentTo;
    private String note;
    private Double confidence;
    private List<String> missingFields;
    private List<ItemDto> items;

    @Getter
    @Builder
    public static class ItemDto {
        private Long productId;
        private Long variantId;
        private String productName;
        private String productCode;
        private String sku;
        private String variant;
        private String size;
        private String color;
        private Integer quantity;
        private Integer rentalDays;
        private BigDecimal price;
        private BigDecimal deposit;
    }
}

package com.oms.module.messenger.dto;

import com.oms.module.messenger.enums.OrderDraftStatus;
import com.oms.module.order.entity.Order;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class OrderDraftResponse {

    private Long id;
    private String draftCode;
    private Long shopId;
    private Long conversationId;
    private String pageId;
    private String customerPsid;
    private String sourceMessageMid;
    private String customerName;
    private String phone;
    private String address;
    private Long shippingMethodId;
    private String shippingMethod;
    private BigDecimal shippingFee;
    private Order.OrderType orderType;
    private String productName;
    private String productCode;
    private Integer quantity;
    private String color;
    private String size;
    private BigDecimal price;
    private BigDecimal depositAmount;
    private BigDecimal subtotal;
    private BigDecimal totalAmount;
    private Integer rentalDays;
    private LocalDate deliveryDate;
    private LocalDate rentFrom;
    private LocalDate rentTo;
    private Double confidence;
    private String note;
    private List<String> missingFields;
    private List<ItemResponse> items;
    private OrderDraftStatus status;
    private String confirmMessage;
    private LocalDateTime expiresAt;
    private LocalDateTime confirmedAt;
    private Long convertedOrderId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Getter
    @Builder
    public static class ItemResponse {
        private Long id;
        private Long productId;
        private Long variantId;
        private String productName;
        private String productCode;
        private String sku;
        private String variant;
        private Integer quantity;
        private Integer rentalDays;
        private BigDecimal price;
        private BigDecimal deposit;
    }
}

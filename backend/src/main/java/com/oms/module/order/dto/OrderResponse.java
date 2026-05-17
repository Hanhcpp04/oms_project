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
@Builder(toBuilder = true)
public class OrderResponse {

    private Long id;
    private String orderCode;
    private Order.OrderType orderType;
    private Order.OrderStatus status;
    private String fulfillmentStatus;
    private String source;
    private Order.PaymentStatus paymentStatus;
    private Order.PaymentMethod paymentMethod;
    private Order.SourceMethod sourceMethod;

    // Customer info
    private String customerName;
    private String customerPhone;
    private String customerAddress;
    private String customerNote;
    private String sourceChannel;
    private Long sourceChannelId;

    // Sell-specific
    private String shippingMethod;
    private BigDecimal shippingFee;

    // Computed
    private BigDecimal totalAmount;
    private BigDecimal depositAmount;

    private String createdByFullName;
    private String createdByUsername;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private List<ItemResponse> items;
    private List<CustomFieldValueResponse> customFieldValues;
    private RentalInfo rentalInfo;
    private MessengerInfo messenger;
    private PaymentCheckoutResponse payment;
    private String trackingToken;

    @Getter
    @Builder
    public static class ItemResponse {
        private Long id;
        private Long variantId;
        private Long productId;
        private String productNameSnapshot;
        private String productImageSnapshot;
        private String categoryNameSnapshot;
        private String skuSnapshot;
        private String variantSizeSnapshot;
        private String variantColorSnapshot;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal lineTotal;
    }

    @Getter
    @Builder
    public static class CustomFieldValueResponse {
        private Long id;
        private Long fieldId;
        private String fieldKeySnapshot;
        private String labelSnapshot;
        private String formTypeSnapshot;
        private String valueJson;
        private Boolean showInListSnapshot;
        private Boolean showInDetailSnapshot;
        private Integer sortOrderSnapshot;
    }

    @Getter
    @Builder
    public static class RentalInfo {
        private LocalDate rentFrom;
        private LocalDate rentTo;
        private BigDecimal depositPaid;
        private String returnStatus;
        private LocalDateTime returnedAt;
    }

    @Getter
    @Builder
    public static class MessengerInfo {
        private String pageId;
        private String customerPsid;
        private Long conversationId;
        private Long draftId;
    }
}

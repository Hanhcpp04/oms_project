package com.oms.module.order.dto;

import com.oms.module.order.entity.Order;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
public class OrderRequest {

    @NotNull(message = "Order type is required")
    private Order.OrderType orderType;

    private String customerName;
    private String customerPhone;
    private String customerAddress;
    private String customerNote;
    private String sourceChannel;
    private Long sourceChannelId;
    private Long shippingMethodId;
    private String shippingMethod;
    private BigDecimal shippingFee;

    /** Phương thức tạo đơn: MANUAL | AI_PARSE | PUBLIC_FORM */
    private Order.SourceMethod sourceMethod = Order.SourceMethod.MANUAL;

    /** Phương thức thanh toán khách chọn: COD | BANK_TRANSFER | VNPAY */
    private Order.PaymentMethod paymentMethod;

    @Valid
    @NotNull(message = "Order items are required")
    @Size(min = 1, message = "At least one item is required")
    private List<ItemRequest> items;

    /** Custom field values từ order_form_config */
    private List<CustomFieldValueRequest> customFieldValues;

    // Rental-specific fields
    private LocalDate rentFrom;
    private LocalDate rentTo;
    private BigDecimal depositPaid;

    @Getter
    @Setter
    public static class ItemRequest {
        @NotNull private Long variantId;
        private Integer quantity = 1;
    }

    @Getter
    @Setter
    public static class CustomFieldValueRequest {
        private Long fieldId;
        private String fieldKeySnapshot;
        private String labelSnapshot;
        private String formTypeSnapshot;
        /** JSON string của giá trị, ví dụ: "\"text value\"" hoặc "42" */
        private String valueJson;
        private Boolean showInListSnapshot = false;
        private Boolean showInDetailSnapshot = true;
        private Integer sortOrderSnapshot = 0;
    }
}

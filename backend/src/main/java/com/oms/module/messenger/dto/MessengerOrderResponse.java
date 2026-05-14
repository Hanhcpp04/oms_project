package com.oms.module.messenger.dto;

import com.oms.module.messenger.enums.MessengerOrderStatus;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class MessengerOrderResponse {

    private Long id;
    private Long orderDraftId;
    private Long conversationId;
    private String customerName;
    private String phone;
    private String address;
    private String productName;
    private String productCode;
    private Integer quantity;
    private String color;
    private String size;
    private BigDecimal price;
    private String note;
    private MessengerOrderStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

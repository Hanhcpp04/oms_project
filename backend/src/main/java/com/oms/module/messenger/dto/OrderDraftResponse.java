package com.oms.module.messenger.dto;

import com.oms.module.messenger.enums.OrderDraftStatus;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class OrderDraftResponse {

    private Long id;
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
    private List<String> missingFields;
    private OrderDraftStatus status;
    private String confirmMessage;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

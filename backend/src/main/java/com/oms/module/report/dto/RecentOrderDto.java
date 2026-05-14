package com.oms.module.report.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecentOrderDto {
    private Long id;
    private String orderNumber;
    private String customerName;
    private String status;
    private BigDecimal total;
    private String createdAt;
    private String orderType;
    private String sourceMethod;
    private String paymentStatus;
}

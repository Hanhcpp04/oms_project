package com.oms.module.messenger.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Builder
public class OrderInfoExtractedDto {

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
}

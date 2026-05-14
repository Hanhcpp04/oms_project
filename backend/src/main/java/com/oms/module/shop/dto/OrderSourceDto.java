package com.oms.module.shop.dto;

import lombok.Data;

@Data
public class OrderSourceDto {
    private Long id;
    private String name;
    private boolean active = true;
}

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
public class EmployeeStatDto {
    private Long id;
    private String name;
    private String avatarInitials;
    private long ordersHandled;
    private BigDecimal revenue;
}

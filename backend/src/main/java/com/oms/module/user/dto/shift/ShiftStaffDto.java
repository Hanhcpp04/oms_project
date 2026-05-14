package com.oms.module.user.dto.shift;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ShiftStaffDto {
    private Long id;
    private String fullName;
    private String username;
    private String email;
}

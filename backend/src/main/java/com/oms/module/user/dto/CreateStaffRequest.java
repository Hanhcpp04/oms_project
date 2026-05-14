package com.oms.module.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateStaffRequest {
    @NotBlank(message = "Full name is required")
    private String fullName;

    private String email;

    private String phone;
}

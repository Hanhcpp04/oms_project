package com.oms.module.user.dto.shift;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Data
public class CreateWorkShiftRequest {

    @NotNull(message = "Ngày làm việc không được để trống")
    private LocalDate shiftDate;

    @NotNull(message = "Giờ bắt đầu không được để trống")
    private LocalTime startTime;

    @NotNull(message = "Giờ kết thúc không được để trống")
    private LocalTime endTime;

    private String name;

    private List<Long> staffIds;
}

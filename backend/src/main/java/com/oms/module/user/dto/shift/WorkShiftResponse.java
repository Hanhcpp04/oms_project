package com.oms.module.user.dto.shift;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Data
@Builder
public class WorkShiftResponse {
    private Long id;
    private LocalDate shiftDate;
    private LocalTime startTime;
    private LocalTime endTime;
    private String name;
    private List<ShiftStaffDto> assignedStaff;
}

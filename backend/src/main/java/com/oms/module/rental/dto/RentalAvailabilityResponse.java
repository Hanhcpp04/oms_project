package com.oms.module.rental.dto;

import com.oms.module.rental.entity.RentalAvailability;
import java.time.LocalDate;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RentalAvailabilityResponse {
    private Long id;
    private Long productId;
    private Long variantId;
    private Long orderId;
    private String orderCode;
    private LocalDate startDate;
    private LocalDate endDate;
    private RentalAvailability.BlockType blockType;
    private String reason;
}

package com.oms.module.rental.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.module.rental.dto.RentalAvailabilityResponse;
import com.oms.module.rental.service.RentalAvailabilityService;
import com.oms.security.CustomUserDetails;
import com.oms.security.PermissionCode;
import com.oms.security.RequirePermission;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rental/availability")
@RequiredArgsConstructor
@Tag(name = "Rental Availability", description = "Rental product availability calendar")
public class RentalAvailabilityController {

    private final RentalAvailabilityService availabilityService;

    @GetMapping
    @Operation(summary = "Get blocked rental date ranges for a product or variant")
    @RequirePermission(PermissionCode.PRODUCT_VIEW)
    public ResponseEntity<ApiResponse<List<RentalAvailabilityResponse>>> getAvailability(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam(required = false) Long productId,
            @RequestParam(required = false) Long variantId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        return ResponseEntity.ok(ApiResponse.ok(availabilityService.getAvailability(
                user.getShopId(),
                productId,
                variantId,
                from,
                to
        )));
    }
}

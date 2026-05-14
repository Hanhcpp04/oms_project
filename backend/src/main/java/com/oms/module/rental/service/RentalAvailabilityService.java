package com.oms.module.rental.service;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.common.exception.ResourceNotFoundException;
import com.oms.module.product.entity.Product;
import com.oms.module.product.entity.ProductVariant;
import com.oms.module.product.repository.ProductRepository;
import com.oms.module.product.repository.ProductVariantRepository;
import com.oms.module.rental.dto.RentalAvailabilityResponse;
import com.oms.module.rental.entity.RentalAvailability;
import com.oms.module.rental.repository.RentalAvailabilityRepository;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RentalAvailabilityService {

    private final RentalAvailabilityRepository availabilityRepository;
    private final ProductRepository productRepository;
    private final ProductVariantRepository variantRepository;

    @Transactional(readOnly = true)
    public List<RentalAvailabilityResponse> getAvailability(
            Long shopId,
            Long productId,
            Long variantId,
            LocalDate startDate,
            LocalDate endDate) {

        LocalDate resolvedStart = startDate != null ? startDate : LocalDate.now();
        LocalDate resolvedEnd = endDate != null ? endDate : resolvedStart.plusDays(60);

        if (resolvedEnd.isBefore(resolvedStart)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "End date must be after start date");
        }

        validateProductAndVariant(shopId, productId, variantId);

        return availabilityRepository
                .findActiveBlocksForShop(shopId, productId, variantId, resolvedStart, resolvedEnd)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean isRangeAvailable(Long shopId, Long variantId, LocalDate startDate, LocalDate endDate) {
        validateProductAndVariant(shopId, null, variantId);
        return availabilityRepository.findConflicts(variantId, startDate, endDate).isEmpty();
    }

    private void validateProductAndVariant(Long shopId, Long productId, Long variantId) {
        if (productId != null) {
            Product product = productRepository.findByIdAndShopId(productId, shopId)
                    .orElseThrow(() -> new ResourceNotFoundException("Product", productId));
            if (!Boolean.TRUE.equals(product.getIsActive())) {
                throw new ResourceNotFoundException("Product", productId);
            }
        }

        if (variantId != null) {
            ProductVariant variant = variantRepository.findById(variantId)
                    .orElseThrow(() -> new ResourceNotFoundException("ProductVariant", variantId));
            if (!Boolean.TRUE.equals(variant.getIsActive())
                    || !Boolean.TRUE.equals(variant.getProduct().getIsActive())
                    || !variant.getProduct().getShop().getId().equals(shopId)
                    || (productId != null && !variant.getProduct().getId().equals(productId))) {
                throw new ResourceNotFoundException("ProductVariant", variantId);
            }
        }
    }

    private RentalAvailabilityResponse toResponse(RentalAvailability availability) {
        return RentalAvailabilityResponse.builder()
                .id(availability.getId())
                .productId(availability.getVariant().getProduct().getId())
                .variantId(availability.getVariant().getId())
                .orderId(availability.getOrder() != null ? availability.getOrder().getId() : null)
                .orderCode(availability.getOrder() != null ? availability.getOrder().getOrderCode() : null)
                .startDate(availability.getStartDate())
                .endDate(availability.getEndDate())
                .blockType(availability.getBlockType())
                .reason(availability.getReason())
                .build();
    }
}

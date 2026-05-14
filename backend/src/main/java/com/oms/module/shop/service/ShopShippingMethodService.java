package com.oms.module.shop.service;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.common.exception.ResourceNotFoundException;
import com.oms.module.shop.dto.ShippingMethodDto;
import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.entity.ShopShippingMethod;
import com.oms.module.shop.repository.ShopRepository;
import com.oms.module.shop.repository.ShopShippingMethodRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ShopShippingMethodService {

    private final ShopShippingMethodRepository shippingMethodRepository;
    private final ShopRepository shopRepository;

    @Transactional(readOnly = true)
    public List<ShippingMethodDto> getAllByShopId(Long shopId) {
        return shippingMethodRepository.findByShopId(shopId).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }
    
    @Transactional(readOnly = true)
    public List<ShippingMethodDto> getActiveByShopId(Long shopId) {
        return shippingMethodRepository.findByShopIdAndIsActiveTrue(shopId).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public ShippingMethodDto create(Long shopId, ShippingMethodDto dto) {
        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new ResourceNotFoundException("Shop", shopId));

        validateFeePolicy(dto);

        ShopShippingMethod method = new ShopShippingMethod();
        method.setShop(shop);
        method.setName(dto.getName());
        method.setFeePolicy(dto.getFeePolicy());
        method.setDefaultFee(dto.getDefaultFee());
        method.setIsActive(dto.isActive());

        ShopShippingMethod saved = shippingMethodRepository.save(method);
        return mapToDto(saved);
    }

    @Transactional
    public ShippingMethodDto update(Long shopId, Long id, ShippingMethodDto dto) {
        ShopShippingMethod method = shippingMethodRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ShopShippingMethod", id));

        if (!method.getShop().getId().equals(shopId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Bạn không có quyền sửa phương thức này");
        }

        validateFeePolicy(dto);

        method.setName(dto.getName());
        method.setFeePolicy(dto.getFeePolicy());
        method.setDefaultFee(dto.getDefaultFee());
        method.setIsActive(dto.isActive());

        ShopShippingMethod saved = shippingMethodRepository.save(method);
        return mapToDto(saved);
    }

    @Transactional
    public void delete(Long shopId, Long id) {
        ShopShippingMethod method = shippingMethodRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ShopShippingMethod", id));

        if (!method.getShop().getId().equals(shopId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Bạn không có quyền xoá phương thức này");
        }

        shippingMethodRepository.delete(method);
    }

    private void validateFeePolicy(ShippingMethodDto dto) {
        if (dto.getFeePolicy() == ShopShippingMethod.FeePolicy.FIXED_FEE) {
            if (dto.getDefaultFee() == null || dto.getDefaultFee().compareTo(BigDecimal.ZERO) < 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Phí cố định phải là một số hợp lệ lớn hơn hoặc bằng 0");
            }
        } else {
            dto.setDefaultFee(null);
        }
    }

    private ShippingMethodDto mapToDto(ShopShippingMethod entity) {
        ShippingMethodDto dto = new ShippingMethodDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        dto.setFeePolicy(entity.getFeePolicy());
        dto.setDefaultFee(entity.getDefaultFee());
        dto.setActive(entity.getIsActive());
        return dto;
    }
}

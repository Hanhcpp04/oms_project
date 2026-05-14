package com.oms.module.shop.service;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.common.exception.ResourceNotFoundException;
import com.oms.module.shop.dto.OrderSourceDto;
import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.entity.ShopOrderSource;
import com.oms.module.shop.repository.ShopRepository;
import com.oms.module.shop.repository.ShopOrderSourceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ShopOrderSourceService {

    private final ShopOrderSourceRepository orderSourceRepository;
    private final ShopRepository shopRepository;

    @Transactional(readOnly = true)
    public List<OrderSourceDto> getAllByShopId(Long shopId) {
        return orderSourceRepository.findByShopId(shopId).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }
    
    @Transactional(readOnly = true)
    public List<OrderSourceDto> getActiveByShopId(Long shopId) {
        return orderSourceRepository.findByShopIdAndIsActiveTrue(shopId).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public OrderSourceDto create(Long shopId, OrderSourceDto dto) {
        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new ResourceNotFoundException("Shop", shopId));

        ShopOrderSource source = new ShopOrderSource();
        source.setShop(shop);
        source.setName(dto.getName());
        source.setIsActive(dto.isActive());

        ShopOrderSource saved = orderSourceRepository.save(source);
        return mapToDto(saved);
    }

    @Transactional
    public OrderSourceDto update(Long shopId, Long id, OrderSourceDto dto) {
        ShopOrderSource source = orderSourceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ShopOrderSource", id));

        if (!source.getShop().getId().equals(shopId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Bạn không có quyền sửa nguồn này");
        }

        source.setName(dto.getName());
        source.setIsActive(dto.isActive());

        ShopOrderSource saved = orderSourceRepository.save(source);
        return mapToDto(saved);
    }

    @Transactional
    public void delete(Long shopId, Long id) {
        ShopOrderSource source = orderSourceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ShopOrderSource", id));

        if (!source.getShop().getId().equals(shopId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Bạn không có quyền xoá nguồn này");
        }

        orderSourceRepository.delete(source);
    }

    private OrderSourceDto mapToDto(ShopOrderSource entity) {
        OrderSourceDto dto = new OrderSourceDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        dto.setActive(entity.getIsActive());
        return dto;
    }
}

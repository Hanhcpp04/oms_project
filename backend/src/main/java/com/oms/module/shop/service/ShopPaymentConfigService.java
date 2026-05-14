package com.oms.module.shop.service;

import com.oms.module.shop.dto.PaymentConfigDto;
import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.entity.ShopPaymentConfig;
import com.oms.module.shop.repository.ShopPaymentConfigRepository;
import com.oms.module.shop.repository.ShopRepository;
import com.oms.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ShopPaymentConfigService {

    private final ShopPaymentConfigRepository paymentConfigRepository;
    private final ShopRepository shopRepository;

    @Transactional(readOnly = true)
    public PaymentConfigDto getByShopId(Long shopId) {
        return paymentConfigRepository.findByShopId(shopId)
                .map(this::mapToDto)
                .orElseGet(PaymentConfigDto::new); // return empty/default if not configured yet
    }

    @Transactional
    public PaymentConfigDto save(Long shopId, PaymentConfigDto dto) {
        ShopPaymentConfig config = paymentConfigRepository.findByShopId(shopId)
                .orElseGet(() -> {
                    Shop shop = shopRepository.findById(shopId)
                            .orElseThrow(() -> new ResourceNotFoundException("Shop", shopId));
                    ShopPaymentConfig newConfig = new ShopPaymentConfig();
                    newConfig.setShop(shop);
                    return newConfig;
                });

        config.setCodEnabled(dto.isCodEnabled());
        config.setBankTransferEnabled(dto.isBankTransferEnabled());
        config.setBankName(dto.getBankName());
        config.setBankCode(dto.getBankCode());
        config.setBankAccountNumber(dto.getBankAccountNumber());
        config.setBankAccountName(dto.getBankAccountName());
        config.setVnpayEnabled(dto.isVnpayEnabled());
        config.setVnpayTmnCode(dto.getVnpayTmnCode());
        config.setVnpayHashSecret(dto.getVnpayHashSecret());

        ShopPaymentConfig saved = paymentConfigRepository.save(config);
        return mapToDto(saved);
    }

    private PaymentConfigDto mapToDto(ShopPaymentConfig entity) {
        PaymentConfigDto dto = new PaymentConfigDto();
        dto.setCodEnabled(Boolean.TRUE.equals(entity.getCodEnabled()));
        dto.setBankTransferEnabled(Boolean.TRUE.equals(entity.getBankTransferEnabled()));
        dto.setBankName(entity.getBankName());
        dto.setBankCode(entity.getBankCode());
        dto.setBankAccountNumber(entity.getBankAccountNumber());
        dto.setBankAccountName(entity.getBankAccountName());
        dto.setVnpayEnabled(Boolean.TRUE.equals(entity.getVnpayEnabled()));
        dto.setVnpayTmnCode(entity.getVnpayTmnCode());
        dto.setVnpayHashSecret(entity.getVnpayHashSecret());
        return dto;
    }

    /**
     * Returns a public-safe DTO (no API secrets) for the given shopId.
     * Used by public order form to show available payment methods.
     */
    @Transactional(readOnly = true)
    public PaymentConfigDto getPublicByShopId(Long shopId) {
        return paymentConfigRepository.findByShopId(shopId)
                .map(entity -> {
                    PaymentConfigDto dto = new PaymentConfigDto();
                    dto.setCodEnabled(Boolean.TRUE.equals(entity.getCodEnabled()));
                    dto.setBankTransferEnabled(Boolean.TRUE.equals(entity.getBankTransferEnabled()));
                    dto.setBankName(entity.getBankName());
                    dto.setBankCode(entity.getBankCode());
                    dto.setBankAccountNumber(entity.getBankAccountNumber());
                    dto.setBankAccountName(entity.getBankAccountName());
                    dto.setVnpayEnabled(Boolean.TRUE.equals(entity.getVnpayEnabled()));
                    // Do NOT expose vnpayTmnCode / vnpayHashSecret publicly
                    return dto;
                })
                .orElseGet(PaymentConfigDto::new);
    }
}

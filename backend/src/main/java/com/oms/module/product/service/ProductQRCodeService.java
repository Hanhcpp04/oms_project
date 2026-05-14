package com.oms.module.product.service;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ResourceNotFoundException;
import com.oms.module.product.dto.ProductQRCodeRequest;
import com.oms.module.product.dto.ProductQRCodeResponse;
import com.oms.module.product.entity.Product;
import com.oms.module.product.entity.ProductQRCode;
import com.oms.module.product.repository.ProductQRCodeRepository;
import com.oms.module.product.repository.ProductRepository;
import com.oms.module.shop.entity.ShopPaymentConfig;
import com.oms.module.shop.repository.ShopPaymentConfigRepository;
import com.oms.module.user.entity.User;
import com.oms.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductQRCodeService {

    private final ProductQRCodeRepository qrCodeRepository;
    private final ProductRepository productRepository;
    private final ShopPaymentConfigRepository paymentConfigRepository;
    private final UserRepository userRepository;

    @Transactional
    public ProductQRCodeResponse generateQRCode(Long shopId, Long userId, Long productId, ProductQRCodeRequest request) {
        Product product = productRepository.findById(productId)
                .filter(p -> p.getShop().getId().equals(shopId))
                .orElseThrow(() -> new ResourceNotFoundException("Product", productId));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        ShopPaymentConfig paymentConfig = paymentConfigRepository.findByShopId(shopId)
                .orElseThrow(() -> new BusinessException(com.oms.common.exception.ErrorCode.BAD_REQUEST, "Shop payment config not found. Please configure bank account first."));

        if (!Boolean.TRUE.equals(paymentConfig.getBankTransferEnabled()) || 
            paymentConfig.getBankCode() == null || 
            paymentConfig.getBankAccountNumber() == null) {
            throw new BusinessException(com.oms.common.exception.ErrorCode.BAD_REQUEST, "Bank transfer is not enabled or bank details are missing.");
        }

        String qrUrl = buildVietQrUrl(paymentConfig, request.getAmount(), request.getNote());

        ProductQRCode qrCode = ProductQRCode.builder()
                .product(product)
                .createdBy(user)
                .qrUrl(qrUrl)
                .amount(request.getAmount())
                .note(request.getNote())
                .productNameAtTime(product.getName())
                .build();

        qrCode = qrCodeRepository.save(qrCode);

        return mapToResponse(qrCode);
    }

    @Transactional(readOnly = true)
    public List<ProductQRCodeResponse> getQRCodeHistory(Long shopId, Long productId) {
        // Verify product belongs to shop
        productRepository.findById(productId)
                .filter(p -> p.getShop().getId().equals(shopId))
                .orElseThrow(() -> new ResourceNotFoundException("Product", productId));

        return qrCodeRepository.findByProductIdOrderByCreatedAtDesc(productId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    private String buildVietQrUrl(ShopPaymentConfig config, BigDecimal amount, String note) {
        String bankCode = config.getBankCode();
        String accountNumber = config.getBankAccountNumber();
        String accountName = URLEncoder.encode(config.getBankAccountName() != null ? config.getBankAccountName() : "", StandardCharsets.UTF_8);
        String addInfo = URLEncoder.encode(note != null ? note : "", StandardCharsets.UTF_8);
        
        long roundedAmount = amount.setScale(0, RoundingMode.HALF_UP).longValue();

        return String.format("https://img.vietqr.io/image/%s-%s-compact.png?amount=%d&addInfo=%s&accountName=%s",
                bankCode, accountNumber, roundedAmount, addInfo, accountName);
    }

    private ProductQRCodeResponse mapToResponse(ProductQRCode qrCode) {
        return ProductQRCodeResponse.builder()
                .id(qrCode.getId())
                .qrUrl(qrCode.getQrUrl())
                .amount(qrCode.getAmount())
                .note(qrCode.getNote())
                .productNameAtTime(qrCode.getProductNameAtTime())
                .createdByFullName(qrCode.getCreatedBy().getFullName())
                .createdAt(qrCode.getCreatedAt())
                .build();
    }
}

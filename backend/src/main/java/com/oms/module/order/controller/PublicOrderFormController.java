package com.oms.module.order.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.common.exception.ResourceNotFoundException;
import com.oms.module.order.dto.OrderRequest;
import com.oms.module.order.dto.OrderResponse;
import com.oms.module.order.entity.Order;
import com.oms.module.order.service.OrderService;
import com.oms.module.product.dto.ProductResponse;
import com.oms.module.product.entity.ProductType;
import com.oms.module.product.service.ProductService;
import com.oms.module.orderform.service.OrderFormConfigService;
import com.oms.module.rental.dto.RentalAvailabilityResponse;
import com.oms.module.rental.service.RentalAvailabilityService;
import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.repository.ShopRepository;
import com.oms.module.shop.service.ShopOrderSourceService;
import com.oms.module.shop.service.ShopPaymentConfigService;
import com.oms.module.shop.service.ShopShippingMethodService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;

/**
 * Public endpoints không cần xác thực — dùng cho form đặt hàng public mà khách hàng điền.
 */
@Slf4j
@RestController
@RequestMapping("/api/public/shops")
@RequiredArgsConstructor
@Tag(name = "Public Order Form", description = "Public form endpoints - no authentication required")
public class PublicOrderFormController {

    private final ShopRepository shopRepository;
    private final OrderService orderService;
    private final ProductService productService;
    private final OrderFormConfigService orderFormConfigService;
    private final ShopShippingMethodService shippingMethodService;
    private final ShopOrderSourceService orderSourceService;
    private final ShopPaymentConfigService paymentConfigService;
    private final RentalAvailabilityService availabilityService;

    /**
     * Lấy thông tin form đặt hàng public của shop (tên shop, danh sách sản phẩm active).
     */
    @GetMapping("/{shopSlug}/form")
    @Operation(summary = "Get public order form config")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getFormConfig(
            @PathVariable String shopSlug) {
        
        log.info("Fetching public form config for shop slug: {}", shopSlug);

        Shop shop = shopRepository.findBySlug(shopSlug)
                .orElseThrow(() -> new ResourceNotFoundException("Shop", "slug", shopSlug));
        rejectIfStorefrontUnavailable(shop);

        List<ProductResponse> products = productService.getActiveProductsForPublicForm(shop.getId());

        Map<String, Object> formConfig = new HashMap<>();
        formConfig.put("shopName", shop.getName());
        formConfig.put("shopSlug", shop.getSlug());
        formConfig.put("logoUrl", shop.getLogoUrl());
        formConfig.put("shopPhone", shop.getSupportPhone() != null ? shop.getSupportPhone() : shop.getPhone());
        formConfig.put("shopEmail", shop.getSupportEmail() != null ? shop.getSupportEmail() : shop.getEmail());
        formConfig.put("businessMode", resolveBusinessMode(shop));
        formConfig.put("showInventoryOnStorefront", Boolean.TRUE.equals(shop.getShowInventoryOnStorefront()));
        formConfig.put("products", products);
        formConfig.put("sellConfig", orderFormConfigService.getOrCreateConfig(shop.getId(), ProductType.SELL));
        formConfig.put("rentConfig", orderFormConfigService.getOrCreateConfig(shop.getId(), ProductType.RENT));
        formConfig.put("rentalIdentityVerificationEnabled", shop.getRentalIdentityVerificationEnabled());
        formConfig.put("shippingMethods", shippingMethodService.getActiveByShopId(shop.getId()));
        formConfig.put("orderSources", orderSourceService.getActiveByShopId(shop.getId()));
        formConfig.put("paymentConfig", paymentConfigService.getPublicByShopId(shop.getId()));

        return ResponseEntity.ok(ApiResponse.ok(formConfig));
    }

    @GetMapping("/{shopSlug}/products/{productId}/availability")
    @Operation(summary = "Get public rental availability blocks for a product or variant")
    public ResponseEntity<ApiResponse<List<RentalAvailabilityResponse>>> getProductAvailability(
            @PathVariable String shopSlug,
            @PathVariable Long productId,
            @RequestParam(required = false) Long variantId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        Shop shop = shopRepository.findBySlug(shopSlug)
                .orElseThrow(() -> new ResourceNotFoundException("Shop", "slug", shopSlug));

        return ResponseEntity.ok(ApiResponse.ok(availabilityService.getAvailability(
                shop.getId(),
                productId,
                variantId,
                from,
                to
        )));
    }

    /**
     * Tạo đơn hàng từ public form — đơn sẽ ở trạng thái PENDING chờ shop duyệt.
     */
    @PostMapping("/{shopSlug}/orders")
    @Operation(summary = "Submit public order form")
    public ResponseEntity<ApiResponse<OrderResponse>> submitPublicOrder(
            @PathVariable String shopSlug,
            @Valid @RequestBody OrderRequest request) {

        Shop shop = shopRepository.findBySlug(shopSlug)
                .orElseThrow(() -> new ResourceNotFoundException("Shop", "slug", shopSlug));
        rejectIfStorefrontUnavailable(shop);

        // Force source method = PUBLIC_FORM so service sets PENDING status
        request.setSourceMethod(Order.SourceMethod.PUBLIC_FORM);

        OrderResponse result = orderService.createOrder(shop.getId(), request, null);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(result));
    }

    private void rejectIfStorefrontUnavailable(Shop shop) {
        if (shop.getStatus() != Shop.ShopStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.SHOP_SUSPENDED, "Shop is not active");
        }

        if (Boolean.TRUE.equals(shop.getMaintenanceMode())) {
            throw new BusinessException(ErrorCode.SHOP_MAINTENANCE, "Shop is currently in maintenance mode");
        }
    }

    private String resolveBusinessMode(Shop shop) {
        boolean enableSell = Boolean.TRUE.equals(shop.getEnableSell());
        boolean enableRent = Boolean.TRUE.equals(shop.getEnableRent());

        if (enableSell && enableRent) {
            return "BOTH";
        }

        return enableSell ? "SELL" : "RENT";
    }
}

package com.oms.module.product.controller;

import com.oms.common.constant.AppConstants;
import com.oms.common.dto.ApiResponse;
import com.oms.common.dto.PageResponse;
import com.oms.module.product.dto.ProductRequest;
import com.oms.module.product.dto.ProductResponse;
import com.oms.module.product.entity.Product;
import com.oms.module.product.entity.ProductType;
import com.oms.module.product.service.ProductService;
import com.oms.security.CustomUserDetails;
import com.oms.security.PermissionCode;
import com.oms.security.RequirePermission;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
@Tag(name = "Products", description = "Product management")
public class ProductController {

    private final ProductService productService;
    private final com.oms.module.product.service.ProductQRCodeService qrCodeService;

    @GetMapping
    @Operation(summary = "Get products with search & pagination")
    @RequirePermission(PermissionCode.PRODUCT_VIEW)
    public ResponseEntity<ApiResponse<PageResponse<ProductResponse>>> getProducts(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) ProductType type,
            @RequestParam(defaultValue = AppConstants.DEFAULT_PAGE_NUMBER) int page,
            @RequestParam(defaultValue = AppConstants.DEFAULT_PAGE_SIZE) int size,
            @RequestParam(defaultValue = AppConstants.DEFAULT_SORT_BY) String sortBy,
            @RequestParam(defaultValue = AppConstants.DEFAULT_SORT_DIR) String sortDir) {

        Sort sort = sortDir.equalsIgnoreCase("asc")
                ? Sort.by(sortBy).ascending()
                : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);

        PageResponse<ProductResponse> result = productService.getProducts(
                user.getShopId(), keyword, type, pageable);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get product detail")
    @RequirePermission(PermissionCode.PRODUCT_VIEW)
    public ResponseEntity<ApiResponse<ProductResponse>> getProduct(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(productService.getProduct(user.getShopId(), id)));
    }

    @PostMapping("/{id}/qr-code")
    @Operation(summary = "Generate QR code for product")
    @RequirePermission(PermissionCode.PRODUCT_QR_CREATE)
    public ResponseEntity<ApiResponse<com.oms.module.product.dto.ProductQRCodeResponse>> generateQRCode(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @Valid @RequestBody com.oms.module.product.dto.ProductQRCodeRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(qrCodeService.generateQRCode(user.getShopId(), user.getUserId(), id, request)));
    }

    @GetMapping("/{id}/qr-code-history")
    @Operation(summary = "Get QR code history for product")
    @RequirePermission(PermissionCode.PRODUCT_VIEW)
    public ResponseEntity<ApiResponse<java.util.List<com.oms.module.product.dto.ProductQRCodeResponse>>> getQRCodeHistory(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(qrCodeService.getQRCodeHistory(user.getShopId(), id)));
    }

    @PostMapping
    @Operation(summary = "Create new product")
    @RequirePermission(PermissionCode.PRODUCT_CREATE)
    public ResponseEntity<ApiResponse<ProductResponse>> createProduct(
            @AuthenticationPrincipal CustomUserDetails user,
            @Valid @RequestBody ProductRequest request) {
        ProductResponse result = productService.createProduct(user.getShopId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(result));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update existing product")
    @RequirePermission(PermissionCode.PRODUCT_EDIT)
    public ResponseEntity<ApiResponse<ProductResponse>> updateProduct(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @Valid @RequestBody ProductRequest request) {
        ProductResponse result = productService.updateProduct(user.getShopId(), id, request);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Soft delete product")
    @RequirePermission(PermissionCode.PRODUCT_DELETE)
    public ResponseEntity<ApiResponse<Void>> deleteProduct(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id) {
        productService.deleteProduct(user.getShopId(), id);
        return ResponseEntity.ok(ApiResponse.ok("Product deleted", null));
    }

    @PatchMapping("/{id}/restore")
    @Operation(summary = "Restore soft deleted product")
    @RequirePermission(PermissionCode.PRODUCT_EDIT)
    public ResponseEntity<ApiResponse<ProductResponse>> restoreProduct(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id) {
        ProductResponse result = productService.restoreProduct(user.getShopId(), id);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }
}

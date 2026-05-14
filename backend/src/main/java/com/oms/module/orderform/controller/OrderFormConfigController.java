package com.oms.module.orderform.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.module.product.entity.ProductType;
import com.oms.module.orderform.dto.OrderFormConfigDtos;
import com.oms.module.orderform.service.OrderFormConfigService;
import com.oms.security.CustomUserDetails;
import com.oms.security.PermissionCode;
import com.oms.security.RequirePermission;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/order-form-configs")
@RequiredArgsConstructor
@Tag(name = "Order Form Configs", description = "Manage shop-specific order form configurations")
public class OrderFormConfigController {

    private final OrderFormConfigService configService;

    @GetMapping("/{formType}")
    @Operation(summary = "Get or create order form config by type")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<OrderFormConfigDtos.ConfigResponse>> getConfig(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable ProductType formType
    ) {
        return ResponseEntity.ok(ApiResponse.ok(configService.getOrCreateConfig(user.getShopId(), formType)));
    }

    @PostMapping("/{formType}/fields")
    @Operation(summary = "Add custom field to order form config")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<OrderFormConfigDtos.CustomFieldResponse>> addField(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable ProductType formType,
            @Valid @RequestBody OrderFormConfigDtos.CreateCustomFieldRequest request
    ) {
        OrderFormConfigDtos.CustomFieldResponse response = configService.addField(user.getShopId(), formType, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(response));
    }

    @PutMapping("/{formType}/fields/{fieldId}")
    @Operation(summary = "Update custom field in order form config")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<OrderFormConfigDtos.CustomFieldResponse>> updateField(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable ProductType formType,
            @PathVariable Long fieldId,
            @Valid @RequestBody OrderFormConfigDtos.UpdateCustomFieldRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok(configService.updateField(user.getShopId(), formType, fieldId, request)));
    }

    @DeleteMapping("/{formType}/fields/{fieldId}")
    @Operation(summary = "Soft delete custom field in order form config")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<Void>> deleteField(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable ProductType formType,
            @PathVariable Long fieldId
    ) {
        configService.deleteField(user.getShopId(), formType, fieldId);
        return ResponseEntity.ok(ApiResponse.ok("Field deleted", null));
    }

    @PutMapping("/{formType}/fields/reorder")
    @Operation(summary = "Reorder custom fields in order form config")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<List<OrderFormConfigDtos.CustomFieldResponse>>> reorderFields(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable ProductType formType,
            @Valid @RequestBody OrderFormConfigDtos.ReorderFieldsRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok(configService.reorderFields(user.getShopId(), formType, request)));
    }

    @PostMapping("/{formType}/fields/{fieldId}/options")
    @Operation(summary = "Add option to custom field")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<OrderFormConfigDtos.OptionResponse>> addOption(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable ProductType formType,
            @PathVariable Long fieldId,
            @Valid @RequestBody OrderFormConfigDtos.OptionRequest request
    ) {
        OrderFormConfigDtos.OptionResponse response = configService.addOption(user.getShopId(), formType, fieldId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(response));
    }

    @PutMapping("/{formType}/fields/{fieldId}/options/{optionId}")
    @Operation(summary = "Update option in custom field")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<OrderFormConfigDtos.OptionResponse>> updateOption(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable ProductType formType,
            @PathVariable Long fieldId,
            @PathVariable Long optionId,
            @Valid @RequestBody OrderFormConfigDtos.OptionRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok(configService.updateOption(user.getShopId(), formType, fieldId, optionId, request)));
    }

    @DeleteMapping("/{formType}/fields/{fieldId}/options/{optionId}")
    @Operation(summary = "Soft delete option in custom field")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<Void>> deleteOption(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable ProductType formType,
            @PathVariable Long fieldId,
            @PathVariable Long optionId
    ) {
        configService.deleteOption(user.getShopId(), formType, fieldId, optionId);
        return ResponseEntity.ok(ApiResponse.ok("Option deleted", null));
    }
}

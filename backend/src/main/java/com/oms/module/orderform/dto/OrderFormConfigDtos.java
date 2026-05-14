package com.oms.module.orderform.dto;

import com.oms.module.product.entity.ProductType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;

public final class OrderFormConfigDtos {

    private OrderFormConfigDtos() {
    }

    public record ConfigResponse(
            Long id,
            ProductType formType,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            List<CustomFieldResponse> customFields
    ) {
    }

    public record CustomFieldResponse(
            Long id,
            Long configId,
            String fieldKey,
            String label,
            String fieldType,
            Boolean isRequired,
            Boolean isActive,
            Integer sortOrder,
            Boolean showInOrderList,
            Boolean showInOrderDetail,
            String placeholder,
            String helperText,
            String validationRulesJson,
            List<OptionResponse> options
    ) {
    }

    public record OptionResponse(
            Long id,
            String label,
            String value,
            Integer sortOrder,
            Boolean isActive
    ) {
    }

    public record CreateCustomFieldRequest(
            @Size(max = 100) String fieldKey,
            @NotBlank @Size(max = 150) String label,
            @NotBlank @Size(max = 20) String fieldType,
            Boolean isRequired,
            Integer sortOrder,
            Boolean showInOrderList,
            Boolean showInOrderDetail,
            @Size(max = 255) String placeholder,
            @Size(max = 255) String helperText,
            String validationRulesJson,
            List<@Valid OptionRequest> options
    ) {
    }

    public record UpdateCustomFieldRequest(
            @Size(max = 100) String fieldKey,
            @Size(max = 150) String label,
            @Size(max = 20) String fieldType,
            Boolean isRequired,
            Boolean isActive,
            Integer sortOrder,
            Boolean showInOrderList,
            Boolean showInOrderDetail,
            @Size(max = 255) String placeholder,
            @Size(max = 255) String helperText,
            String validationRulesJson,
            List<@Valid OptionRequest> options
    ) {
    }

    public record ReorderFieldsRequest(
            @NotEmpty List<@Valid ReorderFieldItem> items
    ) {
    }

    public record ReorderFieldItem(
            @NotNull Long fieldId,
            @NotNull Integer sortOrder
    ) {
    }

    public record OptionRequest(
            Long id,
            @NotBlank @Size(max = 150) String label,
            @Size(max = 150) String value,
            Integer sortOrder,
            Boolean isActive
    ) {
    }
}

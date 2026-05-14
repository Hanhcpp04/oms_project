package com.oms.module.formtemplate.dto;

import com.oms.module.formtemplate.entity.FormTemplate;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public final class FormTemplateDtos {

    private FormTemplateDtos() {
    }

    public record TemplateSummaryResponse(
            Long id,
            String name,
            String description,
            FormTemplate.FormType formType,
            FormTemplate.FormCategory category,
            FormTemplate.FormStatus status,
            Boolean isPublic,
            String publicSlug,
            Integer versionNo,
            long fieldCount,
            LocalDateTime updatedAt
    ) {
    }

    public record TemplateDetailResponse(
            Long id,
            String name,
            String description,
            FormTemplate.FormType formType,
            FormTemplate.FormCategory category,
            FormTemplate.FormStatus status,
            Boolean isPublic,
            String publicSlug,
            Integer versionNo,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            List<FieldResponse> fields
    ) {
    }

    public record FieldResponse(
            Long id,
            Long templateId,
            String fieldKey,
            String label,
            String fieldType,
            String semanticKey,
            String placeholder,
            String helperText,
            String defaultValue,
            Boolean isRequired,
            Boolean isActive,
            Boolean showInOrderList,
            Boolean showInOrderDetail,
            Integer sortOrder,
            Map<String, Object> validationRules,
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

    public record PublicTemplateResponse(
            Long id,
            String name,
            String description,
            List<PublicFieldResponse> fields
    ) {
    }

    public record PublicFieldResponse(
            Long id,
            String fieldKey,
            String label,
            String fieldType,
            Boolean isRequired,
            Integer sortOrder,
            String placeholder,
            String helperText,
            String defaultValue,
            List<OptionResponse> options
    ) {
    }

    public record CreateTemplateRequest(
            @NotBlank @Size(max = 150) String name,
            @Size(max = 255) String description,
            @NotNull FormTemplate.FormType formType,
            FormTemplate.FormCategory category,
            Boolean isPublic
    ) {
    }

    public record UpdateTemplateRequest(
            @Size(max = 150) String name,
            @Size(max = 255) String description,
            Boolean isPublic,
            FormTemplate.FormStatus status
    ) {
    }

    public record CreateFieldRequest(
            @Size(max = 100) String fieldKey,
            @NotBlank @Size(max = 150) String label,
            @NotBlank @Size(max = 30) String fieldType,
            @Size(max = 50) String semanticKey,
            Boolean isRequired,
            Integer sortOrder,
            @Size(max = 255) String placeholder,
            @Size(max = 255) String helperText,
            @Size(max = 255) String defaultValue,
            Boolean showInOrderList,
            Boolean showInOrderDetail,
            Map<String, Object> validationRules,
            List<OptionRequest> options
    ) {
    }

    public record UpdateFieldRequest(
            @Size(max = 100) String fieldKey,
            @Size(max = 150) String label,
            @Size(max = 30) String fieldType,
            @Size(max = 50) String semanticKey,
            Boolean isRequired,
            Boolean isActive,
            Integer sortOrder,
            @Size(max = 255) String placeholder,
            @Size(max = 255) String helperText,
            @Size(max = 255) String defaultValue,
            Boolean showInOrderList,
            Boolean showInOrderDetail,
            Map<String, Object> validationRules,
            List<OptionUpdateRequest> options
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
            @NotBlank @Size(max = 150) String label,
            @Size(max = 150) String value,
            Integer sortOrder,
            Boolean isActive
    ) {
    }

    public record OptionUpdateRequest(
            Long id,
            @NotBlank @Size(max = 150) String label,
            @Size(max = 150) String value,
            Integer sortOrder,
            Boolean isActive
    ) {
    }
}

package com.oms.module.formtemplate.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.module.formtemplate.dto.FormTemplateDtos;
import com.oms.module.formtemplate.entity.FormTemplate;
import com.oms.module.formtemplate.service.FormTemplateService;
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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/form-templates")
@RequiredArgsConstructor
@Tag(name = "Form Templates", description = "Manage order/public form templates")
public class FormTemplateController {

    private final FormTemplateService formTemplateService;

    @GetMapping
    @Operation(summary = "Get form templates")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<List<FormTemplateDtos.TemplateSummaryResponse>>> getTemplates(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestParam(required = false) FormTemplate.FormType formType,
            @RequestParam(required = false) FormTemplate.FormStatus status,
            @RequestParam(required = false) FormTemplate.FormCategory category
    ) {
        return ResponseEntity.ok(ApiResponse.ok(formTemplateService.getTemplates(user.getShopId(), formType, status, category)));
    }

    @PostMapping
    @Operation(summary = "Create form template")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<FormTemplateDtos.TemplateDetailResponse>> createTemplate(
            @AuthenticationPrincipal CustomUserDetails user,
            @Valid @RequestBody FormTemplateDtos.CreateTemplateRequest request
    ) {
        FormTemplateDtos.TemplateDetailResponse response = formTemplateService.createTemplate(
                user.getShopId(),
                user.getUserId(),
                request
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(response));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get form template detail")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<FormTemplateDtos.TemplateDetailResponse>> getTemplate(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(ApiResponse.ok(formTemplateService.getTemplate(user.getShopId(), id)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update form template")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<FormTemplateDtos.TemplateDetailResponse>> updateTemplate(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @Valid @RequestBody FormTemplateDtos.UpdateTemplateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok(formTemplateService.updateTemplate(user.getShopId(), id, request)));
    }

    @PostMapping("/{id}/duplicate")
    @Operation(summary = "Duplicate form template")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<FormTemplateDtos.TemplateDetailResponse>> duplicateTemplate(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id
    ) {
        FormTemplateDtos.TemplateDetailResponse response = formTemplateService.duplicateTemplate(
                user.getShopId(),
                id,
                user.getUserId()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(response));
    }

    @PostMapping("/{id}/fields")
    @Operation(summary = "Add field to form template")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<FormTemplateDtos.FieldResponse>> addField(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @Valid @RequestBody FormTemplateDtos.CreateFieldRequest request
    ) {
        FormTemplateDtos.FieldResponse response = formTemplateService.addField(user.getShopId(), id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(response));
    }

    @PutMapping("/{id}/fields/{fieldId}")
    @Operation(summary = "Update form template field")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<FormTemplateDtos.FieldResponse>> updateField(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @PathVariable Long fieldId,
            @Valid @RequestBody FormTemplateDtos.UpdateFieldRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok(formTemplateService.updateField(user.getShopId(), id, fieldId, request)));
    }

    @DeleteMapping("/{id}/fields/{fieldId}")
    @Operation(summary = "Soft delete form template field")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<Void>> deleteField(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @PathVariable Long fieldId
    ) {
        formTemplateService.deleteField(user.getShopId(), id, fieldId);
        return ResponseEntity.ok(ApiResponse.ok("Field deleted", null));
    }

    @PutMapping("/{id}/fields/reorder")
    @Operation(summary = "Reorder form template fields")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<List<FormTemplateDtos.FieldResponse>>> reorderFields(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @Valid @RequestBody FormTemplateDtos.ReorderFieldsRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok(formTemplateService.reorderFields(user.getShopId(), id, request)));
    }

    @PostMapping("/{id}/fields/{fieldId}/options")
    @Operation(summary = "Add option to form template field")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<FormTemplateDtos.OptionResponse>> addOption(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @PathVariable Long fieldId,
            @Valid @RequestBody FormTemplateDtos.OptionRequest request
    ) {
        FormTemplateDtos.OptionResponse response = formTemplateService.addOption(user.getShopId(), id, fieldId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(response));
    }

    @PutMapping("/{id}/fields/{fieldId}/options/{optionId}")
    @Operation(summary = "Update form template field option")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<FormTemplateDtos.OptionResponse>> updateOption(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @PathVariable Long fieldId,
            @PathVariable Long optionId,
            @Valid @RequestBody FormTemplateDtos.OptionRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.ok(formTemplateService.updateOption(
                user.getShopId(),
                id,
                fieldId,
                optionId,
                request
        )));
    }

    @DeleteMapping("/{id}/fields/{fieldId}/options/{optionId}")
    @Operation(summary = "Soft delete form template field option")
    @RequirePermission(PermissionCode.SHOP_SETTINGS)
    public ResponseEntity<ApiResponse<Void>> deleteOption(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @PathVariable Long fieldId,
            @PathVariable Long optionId
    ) {
        formTemplateService.deleteOption(user.getShopId(), id, fieldId, optionId);
        return ResponseEntity.ok(ApiResponse.ok("Option deleted", null));
    }
}

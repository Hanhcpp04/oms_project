package com.oms.module.formtemplate.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.module.formtemplate.dto.FormTemplateDtos;
import com.oms.module.formtemplate.service.FormTemplateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/forms")
@RequiredArgsConstructor
@Tag(name = "Public Forms", description = "Public access for published forms")
public class PublicFormController {

    private final FormTemplateService formTemplateService;

    @GetMapping("/{id}")
    @Operation(summary = "Get a published public form")
    public ResponseEntity<ApiResponse<FormTemplateDtos.PublicTemplateResponse>> getPublicForm(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(formTemplateService.getPublicTemplate(id)));
    }
}

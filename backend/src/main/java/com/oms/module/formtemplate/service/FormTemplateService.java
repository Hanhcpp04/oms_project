package com.oms.module.formtemplate.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.common.exception.ResourceNotFoundException;
import com.oms.common.util.SlugUtils;
import com.oms.module.formtemplate.dto.FormTemplateDtos;
import com.oms.module.formtemplate.entity.FormTemplate;
import com.oms.module.formtemplate.entity.FormTemplateField;
import com.oms.module.formtemplate.entity.FormTemplateFieldOption;
import com.oms.module.formtemplate.repository.FormTemplateFieldOptionRepository;
import com.oms.module.formtemplate.repository.FormTemplateFieldRepository;
import com.oms.module.formtemplate.repository.FormTemplateRepository;
import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.repository.ShopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class FormTemplateService {

    private static final Pattern NON_FIELD_KEY = Pattern.compile("[^a-zA-Z0-9]+");
    private static final List<String> ALLOWED_SEMANTIC_KEYS = List.of(
            "customerName",
            "customerPhone",
            "customerAddress",
            "note",
            "slaHours",
            "rentFrom",
            "rentTo",
            "depositAmount",
            "productName",
            "productQuantity",
            "orderType",
            "shippingMethod",
            "shippingFee",
            "sourceChannel"
    );

    private final FormTemplateRepository templateRepository;
    private final FormTemplateFieldRepository fieldRepository;
    private final FormTemplateFieldOptionRepository optionRepository;
    private final ShopRepository shopRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<FormTemplateDtos.TemplateSummaryResponse> getTemplates(
            Long shopId,
            FormTemplate.FormType formType,
            FormTemplate.FormStatus status,
            FormTemplate.FormCategory category
    ) {
        List<FormTemplate> templates;

        if (formType != null) {
            templates = templateRepository.findByShopIdAndFormTypeOrderByUpdatedAtDesc(shopId, formType);
        } else if (status != null) {
            templates = templateRepository.findByShopIdAndStatusOrderByUpdatedAtDesc(shopId, status);
        } else if (category != null) {
            templates = templateRepository.findByShopIdAndCategoryOrderByUpdatedAtDesc(shopId, category);
        } else {
            templates = templateRepository.findByShopIdOrderByUpdatedAtDesc(shopId);
        }

        return templates.stream()
                .filter(template -> category == null || template.getCategory() == category)
                .filter(template -> status == null || template.getStatus() == status)
                .map(this::toSummaryResponse)
                .toList();
    }

    @Transactional
    public FormTemplateDtos.TemplateDetailResponse createTemplate(
            Long shopId,
            Long userId,
            FormTemplateDtos.CreateTemplateRequest request
    ) {
        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new ResourceNotFoundException("Shop", shopId));

        FormTemplate template = FormTemplate.builder()
                .shop(shop)
                .name(request.name().trim())
                .description(normalizeNullable(request.description()))
                .formType(request.formType())
                .category(request.category())
                .status(FormTemplate.FormStatus.DRAFT)
                .isPublic(Boolean.TRUE.equals(request.isPublic()))
                .publicSlug(Boolean.TRUE.equals(request.isPublic()) ? generateUniqueSlug(request.name()) : null)
                .versionNo(1)
                .createdByUserId(userId)
                .build();

        return toDetailResponse(templateRepository.save(template));
    }

    @Transactional(readOnly = true)
    public FormTemplateDtos.TemplateDetailResponse getTemplate(Long shopId, Long templateId) {
        return toDetailResponse(getTemplateEntity(shopId, templateId));
    }

    @Transactional
    public FormTemplateDtos.TemplateDetailResponse updateTemplate(
            Long shopId,
            Long templateId,
            FormTemplateDtos.UpdateTemplateRequest request
    ) {
        FormTemplate template = getTemplateEntity(shopId, templateId);
        FormTemplate.FormStatus previousStatus = template.getStatus();

        if (request.name() != null && !request.name().isBlank()) {
            template.setName(request.name().trim());
        }
        if (request.description() != null) {
            template.setDescription(normalizeNullable(request.description()));
        }
        if (request.isPublic() != null) {
            template.setIsPublic(request.isPublic());
            if (Boolean.TRUE.equals(request.isPublic()) && normalizeNullable(template.getPublicSlug()) == null) {
                template.setPublicSlug(generateUniqueSlug(template.getName()));
            }
            if (Boolean.FALSE.equals(request.isPublic())) {
                template.setPublicSlug(null);
            }
        }
        if (request.status() != null) {
            if (request.status() == FormTemplate.FormStatus.PUBLISHED && countActiveFields(template) == 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Cannot publish a form without active fields");
            }
            template.setStatus(request.status());
            if (previousStatus != request.status() && request.status() == FormTemplate.FormStatus.PUBLISHED) {
                template.setVersionNo((template.getVersionNo() == null ? 0 : template.getVersionNo()) + 1);
            }
        }

        return toDetailResponse(templateRepository.save(template));
    }

    @Transactional
    public FormTemplateDtos.TemplateDetailResponse duplicateTemplate(Long shopId, Long templateId, Long userId) {
        FormTemplate source = getTemplateEntity(shopId, templateId);
        FormTemplate copy = FormTemplate.builder()
                .shop(source.getShop())
                .name("Copy of " + source.getName())
                .description(source.getDescription())
                .formType(source.getFormType())
                .category(source.getCategory())
                .status(FormTemplate.FormStatus.DRAFT)
                .isPublic(false)
                .publicSlug(null)
                .versionNo(1)
                .createdByUserId(userId)
                .build();

        for (FormTemplateField sourceField : source.getFields()) {
            FormTemplateField copiedField = FormTemplateField.builder()
                    .template(copy)
                    .fieldKey(sourceField.getFieldKey())
                    .semanticKey(sourceField.getSemanticKey())
                    .label(sourceField.getLabel())
                    .fieldType(sourceField.getFieldType())
                    .placeholder(sourceField.getPlaceholder())
                    .helperText(sourceField.getHelperText())
                    .defaultValue(sourceField.getDefaultValue())
                    .isRequired(sourceField.getIsRequired())
                    .isActive(sourceField.getIsActive())
                    .showInOrderList(sourceField.getShowInOrderList())
                    .showInOrderDetail(sourceField.getShowInOrderDetail())
                    .sortOrder(sourceField.getSortOrder())
                    .validationRulesJson(sourceField.getValidationRulesJson())
                    .build();

            for (FormTemplateFieldOption sourceOption : sourceField.getOptions()) {
                copiedField.getOptions().add(FormTemplateFieldOption.builder()
                        .field(copiedField)
                        .label(sourceOption.getLabel())
                        .value(sourceOption.getValue())
                        .sortOrder(sourceOption.getSortOrder())
                        .isActive(sourceOption.getIsActive())
                        .build());
            }

            copy.getFields().add(copiedField);
        }

        return toDetailResponse(templateRepository.save(copy));
    }

    @Transactional
    public FormTemplateDtos.FieldResponse addField(
            Long shopId,
            Long templateId,
            FormTemplateDtos.CreateFieldRequest request
    ) {
        FormTemplate template = getTemplateEntity(shopId, templateId);
        String fieldKey = normalizeFieldKey(request.fieldKey(), request.label());
        String semanticKey = normalizeSemanticKey(request.semanticKey());

        if (fieldRepository.existsByTemplateIdAndFieldKeyIgnoreCase(templateId, fieldKey)) {
            throw new BusinessException(ErrorCode.DUPLICATE_RESOURCE, "Field key already exists in this form");
        }
        if (semanticKey != null && fieldRepository.existsByTemplateIdAndSemanticKeyIgnoreCase(templateId, semanticKey)) {
            throw new BusinessException(ErrorCode.DUPLICATE_RESOURCE, "Semantic key already exists in this form");
        }

        FormTemplateField field = FormTemplateField.builder()
                .template(template)
                .fieldKey(fieldKey)
                .semanticKey(semanticKey)
                .label(request.label().trim())
                .fieldType(request.fieldType().trim())
                .placeholder(normalizeNullable(request.placeholder()))
                .helperText(normalizeNullable(request.helperText()))
                .defaultValue(normalizeNullable(request.defaultValue()))
                .isRequired(Boolean.TRUE.equals(request.isRequired()))
                .isActive(true)
                .showInOrderList(Boolean.TRUE.equals(request.showInOrderList()))
                .showInOrderDetail(request.showInOrderDetail() == null || request.showInOrderDetail())
                .sortOrder(request.sortOrder() == null ? resolveNextFieldOrder(template) : request.sortOrder())
                .validationRulesJson(writeJson(request.validationRules()))
                .build();

        // Handle options if provided
        if (request.options() != null && !request.options().isEmpty()) {
            for (FormTemplateDtos.OptionRequest optReq : request.options()) {
                field.getOptions().add(FormTemplateFieldOption.builder()
                        .field(field)
                        .label(optReq.label().trim())
                        .value(normalizeOptionValue(optReq.value(), optReq.label()))
                        .sortOrder(optReq.sortOrder() != null ? optReq.sortOrder() : 0)
                        .isActive(optReq.isActive() == null || optReq.isActive())
                        .build());
            }
        }

        return toFieldResponse(fieldRepository.save(field));
    }

    @Transactional
    public FormTemplateDtos.FieldResponse updateField(
            Long shopId,
            Long templateId,
            Long fieldId,
            FormTemplateDtos.UpdateFieldRequest request
    ) {
        FormTemplateField field = getFieldEntity(shopId, templateId, fieldId);

        if (request.fieldKey() != null && !request.fieldKey().isBlank()) {
            String normalizedFieldKey = normalizeFieldKey(request.fieldKey(), field.getLabel());
            if (fieldRepository.existsByTemplateIdAndFieldKeyIgnoreCaseAndIdNot(templateId, normalizedFieldKey, fieldId)) {
                throw new BusinessException(ErrorCode.DUPLICATE_RESOURCE, "Field key already exists in this form");
            }
            field.setFieldKey(normalizedFieldKey);
        }

        if (request.semanticKey() != null) {
            String semanticKey = normalizeSemanticKey(request.semanticKey());
            if (semanticKey != null
                    && fieldRepository.existsByTemplateIdAndSemanticKeyIgnoreCaseAndIdNot(templateId, semanticKey, fieldId)) {
                throw new BusinessException(ErrorCode.DUPLICATE_RESOURCE, "Semantic key already exists in this form");
            }
            field.setSemanticKey(semanticKey);
        }

        if (request.label() != null && !request.label().isBlank()) {
            field.setLabel(request.label().trim());
        }
        if (request.fieldType() != null && !request.fieldType().isBlank()) {
            field.setFieldType(request.fieldType().trim());
        }
        if (request.isRequired() != null) {
            field.setIsRequired(request.isRequired());
        }
        if (request.isActive() != null) {
            field.setIsActive(request.isActive());
        }
        if (request.sortOrder() != null) {
            field.setSortOrder(request.sortOrder());
        }
        if (request.placeholder() != null) {
            field.setPlaceholder(normalizeNullable(request.placeholder()));
        }
        if (request.helperText() != null) {
            field.setHelperText(normalizeNullable(request.helperText()));
        }
        if (request.defaultValue() != null) {
            field.setDefaultValue(normalizeNullable(request.defaultValue()));
        }
        if (request.showInOrderList() != null) {
            field.setShowInOrderList(request.showInOrderList());
        }
        if (request.showInOrderDetail() != null) {
            field.setShowInOrderDetail(request.showInOrderDetail());
        }
        if (request.validationRules() != null) {
            field.setValidationRulesJson(writeJson(request.validationRules()));
        }

        // Sync options if provided
        if (request.options() != null) {
            List<FormTemplateFieldOption> existingOptions = field.getOptions();
            
            // Remove options not in request
            existingOptions.removeIf(existing -> request.options().stream()
                    .noneMatch(optReq -> optReq.id() != null && optReq.id().equals(existing.getId())));

            // Update or Create
            for (FormTemplateDtos.OptionUpdateRequest optReq : request.options()) {
                if (optReq.id() != null) {
                    existingOptions.stream()
                            .filter(eo -> eo.getId().equals(optReq.id()))
                            .findFirst()
                            .ifPresent(eo -> {
                                eo.setLabel(optReq.label().trim());
                                eo.setValue(normalizeOptionValue(optReq.value(), optReq.label()));
                                eo.setSortOrder(optReq.sortOrder());
                                eo.setIsActive(optReq.isActive() == null || optReq.isActive());
                            });
                } else {
                    existingOptions.add(FormTemplateFieldOption.builder()
                            .field(field)
                            .label(optReq.label().trim())
                            .value(normalizeOptionValue(optReq.value(), optReq.label()))
                            .sortOrder(optReq.sortOrder() != null ? optReq.sortOrder() : 0)
                            .isActive(optReq.isActive() == null || optReq.isActive())
                            .build());
                }
            }
        }

        return toFieldResponse(fieldRepository.save(field));
    }

    @Transactional
    public void deleteField(Long shopId, Long templateId, Long fieldId) {
        FormTemplateField field = getFieldEntity(shopId, templateId, fieldId);
        field.setIsActive(false);
        fieldRepository.save(field);
    }

    @Transactional
    public List<FormTemplateDtos.FieldResponse> reorderFields(
            Long shopId,
            Long templateId,
            FormTemplateDtos.ReorderFieldsRequest request
    ) {
        FormTemplate template = getTemplateEntity(shopId, templateId);
        Map<Long, FormTemplateField> fieldMap = template.getFields().stream()
                .collect(LinkedHashMap::new, (map, field) -> map.put(field.getId(), field), Map::putAll);

        for (FormTemplateDtos.ReorderFieldItem item : request.items()) {
            FormTemplateField field = fieldMap.get(item.fieldId());
            if (field == null) {
                throw new ResourceNotFoundException("FormTemplateField", item.fieldId());
            }
            field.setSortOrder(item.sortOrder());
        }

        return template.getFields().stream()
                .map(fieldRepository::save)
                .map(this::toFieldResponse)
                .toList();
    }

    @Transactional
    public FormTemplateDtos.OptionResponse addOption(
            Long shopId,
            Long templateId,
            Long fieldId,
            FormTemplateDtos.OptionRequest request
    ) {
        FormTemplateField field = getFieldEntity(shopId, templateId, fieldId);
        FormTemplateFieldOption option = FormTemplateFieldOption.builder()
                .field(field)
                .label(request.label().trim())
                .value(normalizeOptionValue(request.value(), request.label()))
                .sortOrder(request.sortOrder() == null ? resolveNextOptionOrder(field) : request.sortOrder())
                .isActive(request.isActive() == null || request.isActive())
                .build();

        return toOptionResponse(optionRepository.save(option));
    }

    @Transactional
    public FormTemplateDtos.OptionResponse updateOption(
            Long shopId,
            Long templateId,
            Long fieldId,
            Long optionId,
            FormTemplateDtos.OptionRequest request
    ) {
        getFieldEntity(shopId, templateId, fieldId);
        FormTemplateFieldOption option = optionRepository.findByIdAndFieldId(optionId, fieldId)
                .orElseThrow(() -> new ResourceNotFoundException("FormTemplateFieldOption", optionId));

        option.setLabel(request.label().trim());
        option.setValue(normalizeOptionValue(request.value(), request.label()));
        if (request.sortOrder() != null) {
            option.setSortOrder(request.sortOrder());
        }
        if (request.isActive() != null) {
            option.setIsActive(request.isActive());
        }

        return toOptionResponse(optionRepository.save(option));
    }

    @Transactional
    public void deleteOption(Long shopId, Long templateId, Long fieldId, Long optionId) {
        getFieldEntity(shopId, templateId, fieldId);
        FormTemplateFieldOption option = optionRepository.findByIdAndFieldId(optionId, fieldId)
                .orElseThrow(() -> new ResourceNotFoundException("FormTemplateFieldOption", optionId));
        option.setIsActive(false);
        optionRepository.save(option);
    }

    @Transactional(readOnly = true)
    public FormTemplateDtos.PublicTemplateResponse getPublicTemplate(Long templateId) {
        FormTemplate template = templateRepository.findByIdAndIsPublicTrueAndStatus(templateId, FormTemplate.FormStatus.PUBLISHED)
                .orElseThrow(() -> new ResourceNotFoundException("FormTemplate", templateId));

        List<FormTemplateDtos.PublicFieldResponse> fields = template.getFields().stream()
                .filter(field -> Boolean.TRUE.equals(field.getIsActive()))
                .map(field -> new FormTemplateDtos.PublicFieldResponse(
                        field.getId(),
                        field.getFieldKey(),
                        field.getLabel(),
                        field.getFieldType(),
                        field.getIsRequired(),
                        field.getSortOrder(),
                        field.getPlaceholder(),
                        field.getHelperText(),
                        field.getDefaultValue(),
                        field.getOptions().stream()
                                .filter(option -> Boolean.TRUE.equals(option.getIsActive()))
                                .map(this::toOptionResponse)
                                .toList()
                ))
                .toList();

        return new FormTemplateDtos.PublicTemplateResponse(
                template.getId(),
                template.getName(),
                template.getDescription(),
                fields
        );
    }

    private FormTemplate getTemplateEntity(Long shopId, Long templateId) {
        return templateRepository.findByIdAndShopId(templateId, shopId)
                .orElseThrow(() -> new ResourceNotFoundException("FormTemplate", templateId));
    }

    private FormTemplateField getFieldEntity(Long shopId, Long templateId, Long fieldId) {
        getTemplateEntity(shopId, templateId);
        return fieldRepository.findByIdAndTemplateId(fieldId, templateId)
                .orElseThrow(() -> new ResourceNotFoundException("FormTemplateField", fieldId));
    }

    private FormTemplateDtos.TemplateSummaryResponse toSummaryResponse(FormTemplate template) {
        return new FormTemplateDtos.TemplateSummaryResponse(
                template.getId(),
                template.getName(),
                template.getDescription(),
                template.getFormType(),
                template.getCategory(),
                template.getStatus(),
                template.getIsPublic(),
                template.getPublicSlug(),
                template.getVersionNo(),
                countActiveFields(template),
                template.getUpdatedAt()
        );
    }

    private FormTemplateDtos.TemplateDetailResponse toDetailResponse(FormTemplate template) {
        List<FormTemplateDtos.FieldResponse> fields = template.getFields().stream()
                .filter(field -> Boolean.TRUE.equals(field.getIsActive()))
                .map(this::toFieldResponse)
                .toList();

        return new FormTemplateDtos.TemplateDetailResponse(
                template.getId(),
                template.getName(),
                template.getDescription(),
                template.getFormType(),
                template.getCategory(),
                template.getStatus(),
                template.getIsPublic(),
                template.getPublicSlug(),
                template.getVersionNo(),
                template.getCreatedAt(),
                template.getUpdatedAt(),
                fields
        );
    }

    private FormTemplateDtos.FieldResponse toFieldResponse(FormTemplateField field) {
        List<FormTemplateDtos.OptionResponse> options = field.getOptions().stream()
                .filter(option -> Boolean.TRUE.equals(option.getIsActive()))
                .map(this::toOptionResponse)
                .toList();

        return new FormTemplateDtos.FieldResponse(
                field.getId(),
                field.getTemplate().getId(),
                field.getFieldKey(),
                field.getLabel(),
                field.getFieldType(),
                field.getSemanticKey(),
                field.getPlaceholder(),
                field.getHelperText(),
                field.getDefaultValue(),
                field.getIsRequired(),
                field.getIsActive(),
                field.getShowInOrderList(),
                field.getShowInOrderDetail(),
                field.getSortOrder(),
                readJson(field.getValidationRulesJson()),
                options
        );
    }

    private FormTemplateDtos.OptionResponse toOptionResponse(FormTemplateFieldOption option) {
        return new FormTemplateDtos.OptionResponse(
                option.getId(),
                option.getLabel(),
                option.getValue(),
                option.getSortOrder(),
                option.getIsActive()
        );
    }

    private long countActiveFields(FormTemplate template) {
        return template.getFields().stream()
                .filter(field -> Boolean.TRUE.equals(field.getIsActive()))
                .count();
    }

    private int resolveNextFieldOrder(FormTemplate template) {
        return template.getFields().stream()
                .map(FormTemplateField::getSortOrder)
                .filter(Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(0) + 1;
    }

    private int resolveNextOptionOrder(FormTemplateField field) {
        return field.getOptions().stream()
                .map(FormTemplateFieldOption::getSortOrder)
                .filter(Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(0) + 1;
    }

    private String generateUniqueSlug(String name) {
        String baseSlug = SlugUtils.toSlug(name);
        if (baseSlug.isBlank()) {
            baseSlug = "form";
        }

        String slug = baseSlug;
        int suffix = 1;
        while (templateRepository.existsByPublicSlug(slug)) {
            slug = baseSlug + "-" + suffix++;
        }
        return slug;
    }

    private String normalizeFieldKey(String requestedFieldKey, String fallbackLabel) {
        String candidate = normalizeNullable(requestedFieldKey);
        if (candidate == null) {
            candidate = fallbackLabel;
        }

        String normalized = NON_FIELD_KEY.matcher(candidate.trim().toLowerCase(Locale.ROOT)).replaceAll("_");
        normalized = normalized.replaceAll("^_+|_+$", "");
        normalized = normalized.replaceAll("_{2,}", "_");
        if (normalized.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Field key is invalid");
        }
        return normalized;
    }

    private String normalizeSemanticKey(String value) {
        String normalized = normalizeNullable(value);
        if (normalized == null) {
            return null;
        }
        if (!ALLOWED_SEMANTIC_KEYS.contains(normalized)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Semantic key is invalid");
        }
        return normalized;
    }

    private String normalizeOptionValue(String requestedValue, String fallbackLabel) {
        String normalized = normalizeNullable(requestedValue);
        return normalized == null ? fallbackLabel.trim() : normalized;
    }

    private String normalizeNullable(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String writeJson(Map<String, Object> value) {
        if (value == null || value.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Validation rules JSON is invalid");
        }
    }

    private Map<String, Object> readJson(String rawJson) {
        if (rawJson == null || rawJson.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(rawJson, new TypeReference<>() {
            });
        } catch (JsonProcessingException exception) {
            return null;
        }
    }
}

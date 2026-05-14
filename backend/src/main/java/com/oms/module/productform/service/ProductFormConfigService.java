package com.oms.module.productform.service;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.common.exception.ResourceNotFoundException;
import com.oms.module.product.entity.ProductType;
import com.oms.module.productform.dto.ProductFormConfigDtos;
import com.oms.module.productform.entity.ProductFormConfig;
import com.oms.module.productform.entity.ProductFormCustomField;
import com.oms.module.productform.entity.ProductFormFieldOption;
import com.oms.module.productform.repository.ProductFormConfigRepository;
import com.oms.module.productform.repository.ProductFormCustomFieldRepository;
import com.oms.module.productform.repository.ProductFormFieldOptionRepository;
import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.repository.ShopRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProductFormConfigService {

    private static final Pattern NON_FIELD_KEY = Pattern.compile("[^a-zA-Z0-9]+");

    private final ProductFormConfigRepository configRepository;
    private final ProductFormCustomFieldRepository fieldRepository;
    private final ProductFormFieldOptionRepository optionRepository;
    private final ShopRepository shopRepository;

    @Transactional
    public ProductFormConfigDtos.ConfigResponse getOrCreateConfig(Long shopId, ProductType formType) {
        if (formType == ProductType.SELL_RENT) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Config must be either SELL or RENT");
        }

        ProductFormConfig config = findFirstConfig(shopId, formType)
                .orElseGet(() -> createDefaultConfig(shopId, formType));

        return toConfigResponse(config);
    }

    private Optional<ProductFormConfig> findFirstConfig(Long shopId, ProductType formType) {
        List<ProductFormConfig> configs = configRepository.findAllByShopIdAndFormType(shopId, formType);
        if (configs.isEmpty()) {
            return Optional.empty();
        }
        if (configs.size() > 1) {
            log.warn("Multiple ProductFormConfigs found for shop {} and type {}. Using the first one.", shopId, formType);
        }
        return Optional.of(configs.get(0));
    }

    private ProductFormConfig createDefaultConfig(Long shopId, ProductType formType) {
        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new ResourceNotFoundException("Shop", shopId));

        ProductFormConfig config = ProductFormConfig.builder()
                .shop(shop)
                .formType(formType)
                .build();

        return configRepository.save(config);
    }

    @Transactional
    public ProductFormConfigDtos.CustomFieldResponse addField(
            Long shopId,
            ProductType formType,
            ProductFormConfigDtos.CreateCustomFieldRequest request
    ) {
        ProductFormConfig config = findFirstConfig(shopId, formType)
                .orElseGet(() -> createDefaultConfig(shopId, formType));
        
        String fieldKey = generateUniqueFieldKey(config.getId(), request.fieldKey(), request.label());

        ProductFormCustomField field = ProductFormCustomField.builder()
                .config(config)
                .fieldKey(fieldKey)
                .label(request.label().trim())
                .fieldType(request.fieldType().trim())
                .isRequired(Boolean.TRUE.equals(request.isRequired()))
                .isEnabled(true)
                .sortOrder(request.sortOrder() == null ? resolveNextFieldOrder(config) : request.sortOrder())
                .placeholder(normalizeNullable(request.placeholder()))
                .helperText(normalizeNullable(request.helperText()))
                .validationRulesJson(request.validationRulesJson())
                .build();

        // Xử lý Options nếu có
        if (request.options() != null && !request.options().isEmpty()) {
            for (ProductFormConfigDtos.OptionRequest optReq : request.options()) {
                ProductFormFieldOption option = ProductFormFieldOption.builder()
                        .field(field)
                        .label(optReq.label().trim())
                        .value(normalizeOptionValue(optReq.value(), optReq.label()))
                        .sortOrder(optReq.sortOrder() != null ? optReq.sortOrder() : 0)
                        .isActive(optReq.isActive() == null || optReq.isActive())
                        .build();
                field.getOptions().add(option);
            }
        }

        field = fieldRepository.save(field);

        return toCustomFieldResponse(field);
    }

    @Transactional
    public ProductFormConfigDtos.CustomFieldResponse updateField(
            Long shopId,
            ProductType formType,
            Long fieldId,
            ProductFormConfigDtos.UpdateCustomFieldRequest request
    ) {
        ProductFormConfig config = findFirstConfig(shopId, formType)
                .orElseThrow(() -> new ResourceNotFoundException("ProductFormConfig", "formType", formType.name()));
        
        ProductFormCustomField field = fieldRepository.findByIdAndConfigId(fieldId, config.getId())
                .orElseThrow(() -> new ResourceNotFoundException("ProductFormCustomField", fieldId));

        if (request.fieldKey() != null && !request.fieldKey().isBlank()) {
            String normalizedFieldKey = normalizeFieldKey(request.fieldKey(), field.getLabel());
            if (fieldRepository.existsByConfigIdAndFieldKeyIgnoreCaseAndIdNot(config.getId(), normalizedFieldKey, fieldId)) {
                throw new BusinessException(ErrorCode.DUPLICATE_RESOURCE, "Field key already exists in this config");
            }
            field.setFieldKey(normalizedFieldKey);
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
        if (request.isEnabled() != null) {
            field.setIsEnabled(request.isEnabled());
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
        if (request.validationRulesJson() != null) {
            field.setValidationRulesJson(request.validationRulesJson());
        }

        // --- Đồng bộ hóa Options ---
        if (request.options() != null) {
            // 1. Lấy danh sách hiện có
            List<ProductFormFieldOption> existingOptions = field.getOptions();
            
            // 2. Xóa hoặc đánh dấu Inactive những option không có trong request (nếu cần)
            // Ở đây tôi sẽ thực hiện sync đơn giản: những gì không có trong request sẽ bị xóa
            existingOptions.removeIf(existing -> {
                boolean stillExists = request.options().stream()
                        .anyMatch(optReq -> optReq.id() != null && optReq.id().equals(existing.getId()));
                return !stillExists;
            });

            // 3. Cập nhật hoặc Thêm mới
            for (ProductFormConfigDtos.OptionRequest optReq : request.options()) {
                if (optReq.id() != null) {
                    // Update
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
                    // Create
                    ProductFormFieldOption newOpt = ProductFormFieldOption.builder()
                            .field(field)
                            .label(optReq.label().trim())
                            .value(normalizeOptionValue(optReq.value(), optReq.label()))
                            .sortOrder(optReq.sortOrder() != null ? optReq.sortOrder() : 0)
                            .isActive(optReq.isActive() == null || optReq.isActive())
                            .build();
                    existingOptions.add(newOpt);
                }
            }
        }

        return toCustomFieldResponse(fieldRepository.save(field));
    }

    @Transactional
    public void deleteField(Long shopId, ProductType formType, Long fieldId) {
        ProductFormConfig config = findFirstConfig(shopId, formType)
                .orElseThrow(() -> new ResourceNotFoundException("ProductFormConfig", "formType", formType.name()));
        
        ProductFormCustomField field = fieldRepository.findByIdAndConfigId(fieldId, config.getId())
                .orElseThrow(() -> new ResourceNotFoundException("ProductFormCustomField", fieldId));
        
        field.setIsEnabled(false);
        fieldRepository.save(field);
    }

    @Transactional
    public List<ProductFormConfigDtos.CustomFieldResponse> reorderFields(
            Long shopId,
            ProductType formType,
            ProductFormConfigDtos.ReorderFieldsRequest request
    ) {
        ProductFormConfig config = findFirstConfig(shopId, formType)
                .orElseThrow(() -> new ResourceNotFoundException("ProductFormConfig", "formType", formType.name()));

        Map<Long, ProductFormCustomField> fieldMap = new LinkedHashMap<>();
        config.getCustomFields().forEach(f -> fieldMap.put(f.getId(), f));

        for (ProductFormConfigDtos.ReorderFieldItem item : request.items()) {
            ProductFormCustomField field = fieldMap.get(item.fieldId());
            if (field == null) {
                throw new ResourceNotFoundException("ProductFormCustomField", item.fieldId());
            }
            field.setSortOrder(item.sortOrder());
        }

        return config.getCustomFields().stream()
                .map(fieldRepository::save)
                .map(this::toCustomFieldResponse)
                .toList();
    }

    @Transactional
    public ProductFormConfigDtos.OptionResponse addOption(
            Long shopId,
            ProductType formType,
            Long fieldId,
            ProductFormConfigDtos.OptionRequest request
    ) {
        ProductFormConfig config = findFirstConfig(shopId, formType)
                .orElseThrow(() -> new ResourceNotFoundException("ProductFormConfig", "formType", formType.name()));
        
        ProductFormCustomField field = fieldRepository.findByIdAndConfigId(fieldId, config.getId())
                .orElseThrow(() -> new ResourceNotFoundException("ProductFormCustomField", fieldId));

        ProductFormFieldOption option = ProductFormFieldOption.builder()
                .field(field)
                .label(request.label().trim())
                .value(normalizeOptionValue(request.value(), request.label()))
                .sortOrder(request.sortOrder() == null ? resolveNextOptionOrder(field) : request.sortOrder())
                .isActive(request.isActive() == null || request.isActive())
                .build();

        return toOptionResponse(optionRepository.save(option));
    }

    @Transactional
    public ProductFormConfigDtos.OptionResponse updateOption(
            Long shopId,
            ProductType formType,
            Long fieldId,
            Long optionId,
            ProductFormConfigDtos.OptionRequest request
    ) {
        ProductFormConfig config = findFirstConfig(shopId, formType)
                .orElseThrow(() -> new ResourceNotFoundException("ProductFormConfig", "formType", formType.name()));
        
        fieldRepository.findByIdAndConfigId(fieldId, config.getId())
                .orElseThrow(() -> new ResourceNotFoundException("ProductFormCustomField", fieldId));

        ProductFormFieldOption option = optionRepository.findByIdAndFieldId(optionId, fieldId)
                .orElseThrow(() -> new ResourceNotFoundException("ProductFormFieldOption", optionId));

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
    public void deleteOption(Long shopId, ProductType formType, Long fieldId, Long optionId) {
        ProductFormConfig config = findFirstConfig(shopId, formType)
                .orElseThrow(() -> new ResourceNotFoundException("ProductFormConfig", "formType", formType.name()));
        
        fieldRepository.findByIdAndConfigId(fieldId, config.getId())
                .orElseThrow(() -> new ResourceNotFoundException("ProductFormCustomField", fieldId));

        ProductFormFieldOption option = optionRepository.findByIdAndFieldId(optionId, fieldId)
                .orElseThrow(() -> new ResourceNotFoundException("ProductFormFieldOption", optionId));
        
        option.setIsActive(false);
        optionRepository.save(option);
    }

    private ProductFormConfigDtos.ConfigResponse toConfigResponse(ProductFormConfig config) {
        List<ProductFormConfigDtos.CustomFieldResponse> fields = config.getCustomFields().stream()
                .filter(field -> Boolean.TRUE.equals(field.getIsEnabled()))
                .map(this::toCustomFieldResponse)
                .toList();

        return new ProductFormConfigDtos.ConfigResponse(
                config.getId(),
                config.getFormType(),
                config.getCreatedAt(),
                config.getUpdatedAt(),
                fields
        );
    }

    private ProductFormConfigDtos.CustomFieldResponse toCustomFieldResponse(ProductFormCustomField field) {
        List<ProductFormConfigDtos.OptionResponse> options = field.getOptions().stream()
                .filter(option -> Boolean.TRUE.equals(option.getIsActive()))
                .map(this::toOptionResponse)
                .toList();

        return new ProductFormConfigDtos.CustomFieldResponse(
                field.getId(),
                field.getConfig().getId(),
                field.getFieldKey(),
                field.getLabel(),
                field.getFieldType(),
                field.getIsRequired(),
                field.getIsEnabled(),
                field.getSortOrder(),
                field.getPlaceholder(),
                field.getHelperText(),
                field.getValidationRulesJson(),
                options
        );
    }

    private ProductFormConfigDtos.OptionResponse toOptionResponse(ProductFormFieldOption option) {
        return new ProductFormConfigDtos.OptionResponse(
                option.getId(),
                option.getLabel(),
                option.getValue(),
                option.getSortOrder(),
                option.getIsActive()
        );
    }

    private int resolveNextFieldOrder(ProductFormConfig config) {
        return config.getCustomFields().stream()
                .map(ProductFormCustomField::getSortOrder)
                .filter(Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(0) + 1;
    }

    private int resolveNextOptionOrder(ProductFormCustomField field) {
        return field.getOptions().stream()
                .map(ProductFormFieldOption::getSortOrder)
                .filter(Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(0) + 1;
    }

    private String generateUniqueFieldKey(Long configId, String requestedKey, String label) {
        String baseKey = normalizeFieldKey(requestedKey, label);
        String finalKey = baseKey;
        int counter = 1;

        while (fieldRepository.existsByConfigIdAndFieldKeyIgnoreCase(configId, finalKey)) {
            finalKey = baseKey + "_" + counter++;
        }

        return finalKey;
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
            normalized = "field_" + System.currentTimeMillis();
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
}

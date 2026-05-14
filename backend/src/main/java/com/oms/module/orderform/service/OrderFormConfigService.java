package com.oms.module.orderform.service;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.common.exception.ResourceNotFoundException;
import com.oms.module.product.entity.ProductType;
import com.oms.module.orderform.dto.OrderFormConfigDtos;
import com.oms.module.orderform.entity.OrderFormConfig;
import com.oms.module.orderform.entity.OrderFormCustomField;
import com.oms.module.orderform.entity.OrderFormFieldOption;
import com.oms.module.orderform.repository.OrderFormConfigRepository;
import com.oms.module.orderform.repository.OrderFormCustomFieldRepository;
import com.oms.module.orderform.repository.OrderFormFieldOptionRepository;
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
public class OrderFormConfigService {

    private static final Pattern NON_FIELD_KEY = Pattern.compile("[^a-zA-Z0-9]+");

    private final OrderFormConfigRepository configRepository;
    private final OrderFormCustomFieldRepository fieldRepository;
    private final OrderFormFieldOptionRepository optionRepository;
    private final ShopRepository shopRepository;

    // ==================== Config ====================

    @Transactional
    public OrderFormConfigDtos.ConfigResponse getOrCreateConfig(Long shopId, ProductType formType) {
        if (formType == ProductType.SELL_RENT) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Config must be either SELL or RENT");
        }

        OrderFormConfig config = findFirstConfig(shopId, formType)
                .orElseGet(() -> createDefaultConfig(shopId, formType));

        return toConfigResponse(config);
    }

    private Optional<OrderFormConfig> findFirstConfig(Long shopId, ProductType formType) {
        List<OrderFormConfig> configs = configRepository.findAllByShopIdAndFormType(shopId, formType);
        if (configs.isEmpty()) {
            return Optional.empty();
        }
        if (configs.size() > 1) {
            log.warn("Multiple OrderFormConfigs found for shop {} and type {}. Using the first one.", shopId, formType);
        }
        return Optional.of(configs.get(0));
    }

    private OrderFormConfig createDefaultConfig(Long shopId, ProductType formType) {
        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new ResourceNotFoundException("Shop", shopId));

        OrderFormConfig config = OrderFormConfig.builder()
                .shop(shop)
                .formType(formType)
                .build();

        return configRepository.save(config);
    }

    // ==================== Fields ====================

    @Transactional
    public OrderFormConfigDtos.CustomFieldResponse addField(
            Long shopId,
            ProductType formType,
            OrderFormConfigDtos.CreateCustomFieldRequest request
    ) {
        OrderFormConfig config = findFirstConfig(shopId, formType)
                .orElseGet(() -> createDefaultConfig(shopId, formType));

        String fieldKey = generateUniqueFieldKey(config.getId(), request.fieldKey(), request.label());

        OrderFormCustomField field = OrderFormCustomField.builder()
                .config(config)
                .fieldKey(fieldKey)
                .label(request.label().trim())
                .fieldType(request.fieldType().trim())
                .isRequired(Boolean.TRUE.equals(request.isRequired()))
                .isActive(true)
                .sortOrder(request.sortOrder() == null ? resolveNextFieldOrder(config) : request.sortOrder())
                .showInOrderList(Boolean.TRUE.equals(request.showInOrderList()))
                .showInOrderDetail(request.showInOrderDetail() == null || request.showInOrderDetail())
                .placeholder(normalizeNullable(request.placeholder()))
                .helperText(normalizeNullable(request.helperText()))
                .validationRulesJson(request.validationRulesJson())
                .build();

        // Xử lý Options nếu có
        if (request.options() != null && !request.options().isEmpty()) {
            for (OrderFormConfigDtos.OptionRequest optReq : request.options()) {
                OrderFormFieldOption option = OrderFormFieldOption.builder()
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
    public OrderFormConfigDtos.CustomFieldResponse updateField(
            Long shopId,
            ProductType formType,
            Long fieldId,
            OrderFormConfigDtos.UpdateCustomFieldRequest request
    ) {
        OrderFormConfig config = findFirstConfig(shopId, formType)
                .orElseThrow(() -> new ResourceNotFoundException("OrderFormConfig", "formType", formType.name()));

        OrderFormCustomField field = fieldRepository.findByIdAndConfigId(fieldId, config.getId())
                .orElseThrow(() -> new ResourceNotFoundException("OrderFormCustomField", fieldId));

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
        if (request.isActive() != null) {
            field.setIsActive(request.isActive());
        }
        if (request.sortOrder() != null) {
            field.setSortOrder(request.sortOrder());
        }
        if (request.showInOrderList() != null) {
            field.setShowInOrderList(request.showInOrderList());
        }
        if (request.showInOrderDetail() != null) {
            field.setShowInOrderDetail(request.showInOrderDetail());
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
            List<OrderFormFieldOption> existingOptions = field.getOptions();

            existingOptions.removeIf(existing -> {
                boolean stillExists = request.options().stream()
                        .anyMatch(optReq -> optReq.id() != null && optReq.id().equals(existing.getId()));
                return !stillExists;
            });

            for (OrderFormConfigDtos.OptionRequest optReq : request.options()) {
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
                    OrderFormFieldOption newOpt = OrderFormFieldOption.builder()
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
        OrderFormConfig config = findFirstConfig(shopId, formType)
                .orElseThrow(() -> new ResourceNotFoundException("OrderFormConfig", "formType", formType.name()));

        OrderFormCustomField field = fieldRepository.findByIdAndConfigId(fieldId, config.getId())
                .orElseThrow(() -> new ResourceNotFoundException("OrderFormCustomField", fieldId));

        field.setIsActive(false);
        fieldRepository.save(field);
    }

    @Transactional
    public List<OrderFormConfigDtos.CustomFieldResponse> reorderFields(
            Long shopId,
            ProductType formType,
            OrderFormConfigDtos.ReorderFieldsRequest request
    ) {
        OrderFormConfig config = findFirstConfig(shopId, formType)
                .orElseThrow(() -> new ResourceNotFoundException("OrderFormConfig", "formType", formType.name()));

        Map<Long, OrderFormCustomField> fieldMap = new LinkedHashMap<>();
        config.getCustomFields().forEach(f -> fieldMap.put(f.getId(), f));

        for (OrderFormConfigDtos.ReorderFieldItem item : request.items()) {
            OrderFormCustomField field = fieldMap.get(item.fieldId());
            if (field == null) {
                throw new ResourceNotFoundException("OrderFormCustomField", item.fieldId());
            }
            field.setSortOrder(item.sortOrder());
        }

        return config.getCustomFields().stream()
                .map(fieldRepository::save)
                .map(this::toCustomFieldResponse)
                .toList();
    }

    // ==================== Options ====================

    @Transactional
    public OrderFormConfigDtos.OptionResponse addOption(
            Long shopId,
            ProductType formType,
            Long fieldId,
            OrderFormConfigDtos.OptionRequest request
    ) {
        OrderFormConfig config = findFirstConfig(shopId, formType)
                .orElseThrow(() -> new ResourceNotFoundException("OrderFormConfig", "formType", formType.name()));

        OrderFormCustomField field = fieldRepository.findByIdAndConfigId(fieldId, config.getId())
                .orElseThrow(() -> new ResourceNotFoundException("OrderFormCustomField", fieldId));

        OrderFormFieldOption option = OrderFormFieldOption.builder()
                .field(field)
                .label(request.label().trim())
                .value(normalizeOptionValue(request.value(), request.label()))
                .sortOrder(request.sortOrder() == null ? resolveNextOptionOrder(field) : request.sortOrder())
                .isActive(request.isActive() == null || request.isActive())
                .build();

        return toOptionResponse(optionRepository.save(option));
    }

    @Transactional
    public OrderFormConfigDtos.OptionResponse updateOption(
            Long shopId,
            ProductType formType,
            Long fieldId,
            Long optionId,
            OrderFormConfigDtos.OptionRequest request
    ) {
        OrderFormConfig config = findFirstConfig(shopId, formType)
                .orElseThrow(() -> new ResourceNotFoundException("OrderFormConfig", "formType", formType.name()));

        fieldRepository.findByIdAndConfigId(fieldId, config.getId())
                .orElseThrow(() -> new ResourceNotFoundException("OrderFormCustomField", fieldId));

        OrderFormFieldOption option = optionRepository.findByIdAndFieldId(optionId, fieldId)
                .orElseThrow(() -> new ResourceNotFoundException("OrderFormFieldOption", optionId));

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
        OrderFormConfig config = findFirstConfig(shopId, formType)
                .orElseThrow(() -> new ResourceNotFoundException("OrderFormConfig", "formType", formType.name()));

        fieldRepository.findByIdAndConfigId(fieldId, config.getId())
                .orElseThrow(() -> new ResourceNotFoundException("OrderFormCustomField", fieldId));

        OrderFormFieldOption option = optionRepository.findByIdAndFieldId(optionId, fieldId)
                .orElseThrow(() -> new ResourceNotFoundException("OrderFormFieldOption", optionId));

        option.setIsActive(false);
        optionRepository.save(option);
    }

    // ==================== Mappers ====================

    private OrderFormConfigDtos.ConfigResponse toConfigResponse(OrderFormConfig config) {
        List<OrderFormConfigDtos.CustomFieldResponse> fields = config.getCustomFields().stream()
                .filter(field -> Boolean.TRUE.equals(field.getIsActive()))
                .map(this::toCustomFieldResponse)
                .toList();

        return new OrderFormConfigDtos.ConfigResponse(
                config.getId(),
                config.getFormType(),
                config.getCreatedAt(),
                config.getUpdatedAt(),
                fields
        );
    }

    private OrderFormConfigDtos.CustomFieldResponse toCustomFieldResponse(OrderFormCustomField field) {
        List<OrderFormConfigDtos.OptionResponse> options = field.getOptions().stream()
                .filter(option -> Boolean.TRUE.equals(option.getIsActive()))
                .map(this::toOptionResponse)
                .toList();

        return new OrderFormConfigDtos.CustomFieldResponse(
                field.getId(),
                field.getConfig().getId(),
                field.getFieldKey(),
                field.getLabel(),
                field.getFieldType(),
                field.getIsRequired(),
                field.getIsActive(),
                field.getSortOrder(),
                field.getShowInOrderList(),
                field.getShowInOrderDetail(),
                field.getPlaceholder(),
                field.getHelperText(),
                field.getValidationRulesJson(),
                options
        );
    }

    private OrderFormConfigDtos.OptionResponse toOptionResponse(OrderFormFieldOption option) {
        return new OrderFormConfigDtos.OptionResponse(
                option.getId(),
                option.getLabel(),
                option.getValue(),
                option.getSortOrder(),
                option.getIsActive()
        );
    }

    // ==================== Helpers ====================

    private int resolveNextFieldOrder(OrderFormConfig config) {
        return config.getCustomFields().stream()
                .map(OrderFormCustomField::getSortOrder)
                .filter(Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(0) + 1;
    }

    private int resolveNextOptionOrder(OrderFormCustomField field) {
        return field.getOptions().stream()
                .map(OrderFormFieldOption::getSortOrder)
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

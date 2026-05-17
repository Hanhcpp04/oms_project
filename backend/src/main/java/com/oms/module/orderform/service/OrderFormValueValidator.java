package com.oms.module.orderform.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.module.order.entity.Order;
import com.oms.module.order.entity.OrderCustomFieldValue;
import com.oms.module.order.dto.OrderRequest;
import com.oms.module.orderform.entity.OrderFormConfig;
import com.oms.module.orderform.entity.OrderFormCustomField;
import com.oms.module.orderform.repository.OrderFormConfigRepository;
import com.oms.module.product.entity.ProductType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
@Slf4j
public class OrderFormValueValidator {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@(.+)$");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^(?:\\+84|84|0)\\d{8,10}$");
    private static final Set<String> ALLOWED_SYSTEM_FIELD_KEYS = Set.of(
            "rental_identity_document_front",
            "rental_identity_document_back"
    );
    private static final Map<String, String> SYSTEM_FIELD_LABELS = Map.of(
            "rental_identity_document_front", "Rental identity document front",
            "rental_identity_document_back", "Rental identity document back"
    );

    private final OrderFormConfigRepository configRepository;
    private final ObjectMapper objectMapper;

    public List<OrderCustomFieldValue> buildValidatedValues(
            Long shopId,
            Order.OrderType orderType,
            List<OrderRequest.CustomFieldValueRequest> requestedValues
    ) {
        OrderFormConfig config = findConfig(shopId, orderType);
        Map<Long, OrderFormCustomField> fieldsById = new LinkedHashMap<>();
        if (config != null) {
            config.getCustomFields().stream()
                    .filter(field -> Boolean.TRUE.equals(field.getIsActive()))
                    .forEach(field -> fieldsById.put(field.getId(), field));
        }

        Map<Long, OrderRequest.CustomFieldValueRequest> submittedByFieldId = new LinkedHashMap<>();
        List<OrderRequest.CustomFieldValueRequest> systemValues = new java.util.ArrayList<>();
        if (requestedValues != null) {
            for (OrderRequest.CustomFieldValueRequest requestedValue : requestedValues) {
                if (requestedValue.getFieldId() == null) {
                    if (isAllowedSystemField(requestedValue)) {
                        systemValues.add(requestedValue);
                        continue;
                    }
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Custom field ID is required");
                }

                if (!fieldsById.containsKey(requestedValue.getFieldId())) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid custom field for this order form");
                }
                submittedByFieldId.put(requestedValue.getFieldId(), requestedValue);
            }
        }

        List<OrderCustomFieldValue> values = new java.util.ArrayList<>();
        for (OrderFormCustomField field : fieldsById.values()) {
            OrderRequest.CustomFieldValueRequest requestedValue = submittedByFieldId.get(field.getId());
            String valueJson = requestedValue == null ? null : requestedValue.getValueJson();

            validate(valueJson, field);
            if (!hasValue(valueJson)) {
                continue;
            }

            values.add(OrderCustomFieldValue.builder()
                    .fieldId(field.getId())
                    .fieldKeySnapshot(field.getFieldKey())
                    .labelSnapshot(field.getLabel())
                    .formTypeSnapshot(field.getFieldType())
                    .valueJson(valueJson)
                    .showInListSnapshot(Boolean.TRUE.equals(field.getShowInOrderList()))
                    .showInDetailSnapshot(!Boolean.FALSE.equals(field.getShowInOrderDetail()))
                    .sortOrderSnapshot(field.getSortOrder() != null ? field.getSortOrder() : 0)
                    .build());
        }

        for (OrderRequest.CustomFieldValueRequest systemValue : systemValues) {
            if (!hasValue(systemValue.getValueJson())) {
                continue;
            }
            String fieldKey = systemValue.getFieldKeySnapshot();
            values.add(OrderCustomFieldValue.builder()
                    .fieldId(null)
                    .fieldKeySnapshot(fieldKey)
                    .labelSnapshot(SYSTEM_FIELD_LABELS.getOrDefault(fieldKey, fieldKey))
                    .formTypeSnapshot("image")
                    .valueJson(systemValue.getValueJson())
                    .showInListSnapshot(false)
                    .showInDetailSnapshot(true)
                    .sortOrderSnapshot(systemValue.getSortOrderSnapshot() != null ? systemValue.getSortOrderSnapshot() : 0)
                    .build());
        }

        return values;
    }

    private OrderFormConfig findConfig(Long shopId, Order.OrderType orderType) {
        ProductType formType = orderType == Order.OrderType.RENT ? ProductType.RENT : ProductType.SELL;
        return configRepository.findAllByShopIdAndFormType(shopId, formType).stream()
                .findFirst()
                .orElse(null);
    }

    private boolean isAllowedSystemField(OrderRequest.CustomFieldValueRequest value) {
        return value != null && ALLOWED_SYSTEM_FIELD_KEYS.contains(value.getFieldKeySnapshot());
    }

    private void validate(String valueJson, OrderFormCustomField field) {
        Object parsedValue = parseValue(valueJson);
        if (Boolean.TRUE.equals(field.getIsRequired()) && isEmptyValue(parsedValue)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " is required");
        }

        if (isEmptyValue(parsedValue)) {
            return;
        }

        String trimmedValue = stringifyScalar(parsedValue).trim();
        switch (field.getFieldType().toLowerCase()) {
            case "email" -> {
                if (!EMAIL_PATTERN.matcher(trimmedValue).matches()) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " must be a valid email");
                }
            }
            case "phone" -> {
                String normalizedPhone = trimmedValue.replaceAll("[\\s.-]", "");
                if (!PHONE_PATTERN.matcher(normalizedPhone).matches()) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " must be a valid phone number");
                }
            }
            case "date" -> {
                try {
                    LocalDate.parse(trimmedValue);
                } catch (DateTimeParseException e) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " must be a valid date (YYYY-MM-DD)");
                }
            }
            case "number" -> {
                try {
                    Double.parseDouble(trimmedValue);
                } catch (NumberFormatException e) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " must be a number");
                }
            }
            case "single_choice", "dropdown" -> validateSingleChoice(trimmedValue, field);
            case "multi_choice" -> validateMultiChoice(parsedValue, field);
            default -> {
                // Plain text-like fields do not need additional type validation.
            }
        }

        if (field.getValidationRulesJson() != null && !field.getValidationRulesJson().isBlank()) {
            try {
                Map<String, Object> rules = objectMapper.readValue(field.getValidationRulesJson(), new TypeReference<>() {});
                applyCustomRules(trimmedValue, rules, field);
            } catch (BusinessException exception) {
                throw exception;
            } catch (Exception exception) {
                log.error("Invalid validation rules for order form field {}: {}", field.getId(), exception.getMessage());
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " has invalid validation rules");
            }
        }
    }

    private Object parseValue(String value) {
        if (value == null || value.trim().isEmpty() || "null".equalsIgnoreCase(value.trim())) {
            return null;
        }

        try {
            return objectMapper.readValue(value, Object.class);
        } catch (Exception ignored) {
            return value;
        }
    }

    private boolean hasValue(String value) {
        return !isEmptyValue(parseValue(value));
    }

    private boolean isEmptyValue(Object value) {
        if (value == null) {
            return true;
        }
        if (value instanceof String stringValue) {
            String normalized = stringValue.trim();
            return normalized.isEmpty() || "\"\"".equals(normalized) || "null".equalsIgnoreCase(normalized);
        }
        if (value instanceof List<?> listValue) {
            return listValue.stream()
                    .filter(Objects::nonNull)
                    .map(String::valueOf)
                    .allMatch(item -> item.trim().isEmpty());
        }
        return false;
    }

    private String stringifyScalar(Object value) {
        return value instanceof List<?> ? "" : String.valueOf(value);
    }

    private Set<String> activeOptionValues(OrderFormCustomField field) {
        Set<String> values = new HashSet<>();
        field.getOptions().stream()
                .filter(option -> Boolean.TRUE.equals(option.getIsActive()))
                .forEach(option -> {
                    values.add(option.getValue());
                    values.add(option.getLabel());
                });
        return values;
    }

    private void validateSingleChoice(String value, OrderFormCustomField field) {
        Set<String> allowedValues = activeOptionValues(field);
        if (!allowedValues.isEmpty() && !allowedValues.contains(value)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " is not an allowed option");
        }
    }

    private void validateMultiChoice(Object value, OrderFormCustomField field) {
        if (!(value instanceof List<?> selectedValues)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " must be a list of options");
        }

        Set<String> allowedValues = activeOptionValues(field);
        if (allowedValues.isEmpty()) {
            return;
        }

        for (Object selectedValue : selectedValues) {
            String normalizedValue = selectedValue == null ? "" : String.valueOf(selectedValue).trim();
            if (!normalizedValue.isEmpty() && !allowedValues.contains(normalizedValue)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " contains an invalid option");
            }
        }
    }

    private void applyCustomRules(String value, Map<String, Object> rules, OrderFormCustomField field) {
        if (rules.containsKey("pattern")) {
            String patternStr = String.valueOf(rules.get("pattern"));
            if (!Pattern.compile(patternStr).matcher(value).matches()) {
                String errorMsg = String.valueOf(rules.getOrDefault("errorMessage", field.getLabel() + " is invalid"));
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, errorMsg);
            }
        }

        if (rules.containsKey("min") && field.getFieldType().equalsIgnoreCase("number")) {
            double min = Double.parseDouble(rules.get("min").toString());
            if (Double.parseDouble(value) < min) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " must be greater than or equal to " + min);
            }
        }

        if (rules.containsKey("max") && field.getFieldType().equalsIgnoreCase("number")) {
            double max = Double.parseDouble(rules.get("max").toString());
            if (Double.parseDouble(value) > max) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " must be less than or equal to " + max);
            }
        }
    }
}

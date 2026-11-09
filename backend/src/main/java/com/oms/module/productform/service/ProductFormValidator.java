package com.oms.module.productform.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.module.productform.entity.ProductFormCustomField;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
@Slf4j
public class ProductFormValidator {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@(.+)$");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^(?:\\+84|84|0)\\d{8,10}$");

    private final ObjectMapper objectMapper;

    public void validate(String value, ProductFormCustomField field) {
        Object parsedValue = parseValue(value);
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
                log.error("Invalid validation rules for product form field {}: {}", field.getId(), exception.getMessage());
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " has invalid validation rules");
            }
        }
    }

    public boolean hasValue(String value) {
        return !isEmptyValue(parseValue(value));
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

    private Set<String> activeOptionValues(ProductFormCustomField field) {
        Set<String> values = new HashSet<>();
        field.getOptions().stream()
                .filter(option -> Boolean.TRUE.equals(option.getIsActive()))
                .forEach(option -> {
                    values.add(option.getValue());
                    values.add(option.getLabel());
                });
        return values;
    }

    private void validateSingleChoice(String value, ProductFormCustomField field) {
        Set<String> allowedValues = activeOptionValues(field);
        if (!allowedValues.isEmpty() && !allowedValues.contains(value)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " is not an allowed option");
        }
    }

    private void validateMultiChoice(Object value, ProductFormCustomField field) {
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

    private void applyCustomRules(String value, Map<String, Object> rules, ProductFormCustomField field) {
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

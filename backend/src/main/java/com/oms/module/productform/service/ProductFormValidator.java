package com.oms.module.productform.service;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.module.productform.entity.ProductFormCustomField;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
@Slf4j
public class ProductFormValidator {

    private final ObjectMapper objectMapper;

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@(.+)$");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^[0-9]{10}$");

    public void validate(String value, ProductFormCustomField field) {
        if (field.getIsRequired() && (value == null || value.trim().isEmpty())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " là bắt buộc");
        }

        if (value == null || value.trim().isEmpty() || value.equals("\"\"") || value.equals("null")) {
            return;
        }

        String rawValue = value;
        try {
            com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(value);
            if (node.isTextual()) {
                rawValue = node.asText();
            } else if (node.isNumber()) {
                rawValue = node.asText();
            }
        } catch (Exception e) {
            // Ignore, use raw value
        }

        String trimmedValue = rawValue.trim();

        // 1. Validate by Field Type
        switch (field.getFieldType().toLowerCase()) {
            case "email":
                if (!EMAIL_PATTERN.matcher(trimmedValue).matches()) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " không đúng định dạng email");
                }
                break;
            case "phone":
                if (!PHONE_PATTERN.matcher(trimmedValue).matches()) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " phải là số điện thoại 10 chữ số");
                }
                break;
            case "date":
                try {
                    LocalDate.parse(trimmedValue);
                } catch (DateTimeParseException e) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " không đúng định dạng ngày (YYYY-MM-DD)");
                }
                break;
            case "number":
                try {
                    Double.parseDouble(trimmedValue);
                } catch (NumberFormatException e) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " phải là một số");
                }
                break;
        }

        // 2. Validate by Custom JSON Rules
        if (field.getValidationRulesJson() != null && !field.getValidationRulesJson().isEmpty()) {
            try {
                Map<String, Object> rules = objectMapper.readValue(field.getValidationRulesJson(), new TypeReference<>() {});
                applyCustomRules(trimmedValue, rules, field);
            } catch (Exception e) {
                log.error("Error parsing validation rules for field {}: {}", field.getId(), e.getMessage());
            }
        }
    }

    private void applyCustomRules(String value, Map<String, Object> rules, ProductFormCustomField field) {
        if (rules.containsKey("pattern")) {
            String patternStr = (String) rules.get("pattern");
            if (!Pattern.compile(patternStr).matcher(value).matches()) {
                String errorMsg = (String) rules.getOrDefault("errorMessage", field.getLabel() + " không hợp lệ");
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, errorMsg);
            }
        }
        
        if (rules.containsKey("min") && field.getFieldType().equalsIgnoreCase("number")) {
            double min = Double.parseDouble(rules.get("min").toString());
            if (Double.parseDouble(value) < min) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " phải lớn hơn hoặc bằng " + min);
            }
        }

        if (rules.containsKey("max") && field.getFieldType().equalsIgnoreCase("number")) {
            double max = Double.parseDouble(rules.get("max").toString());
            if (Double.parseDouble(value) > max) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, field.getLabel() + " phải nhỏ hơn hoặc bằng " + max);
            }
        }
    }
}

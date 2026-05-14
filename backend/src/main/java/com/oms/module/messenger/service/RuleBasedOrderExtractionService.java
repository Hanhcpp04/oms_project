package com.oms.module.messenger.service;

import com.oms.module.messenger.dto.OrderInfoExtractedDto;
import com.oms.module.messenger.entity.Message;
import com.oms.module.messenger.enums.MessageSenderType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class RuleBasedOrderExtractionService implements OrderExtractionService {

    private static final Pattern PHONE_PATTERN = Pattern.compile("(?<!\\d)(?:\\+?84|0)(?:[\\s.\\-]?\\d){8,10}(?!\\d)");
    private static final Pattern QUANTITY_BY_KEYWORD_PATTERN = Pattern.compile("(?iu)(?:số\\s*lượng|so\\s*luong|\\bsl\\b)\\s*[:\\-]?\\s*(\\d{1,4})");
    private static final Pattern QUANTITY_BY_UNIT_PATTERN = Pattern.compile("(?iu)\\b(\\d{1,4})\\s*(?:cái|cai|chiếc|chiec|sp|sản\\s*phẩm|san\\s*pham|bộ|bo)\\b");
    private static final Pattern SIZE_PATTERN = Pattern.compile("(?iu)\\b(XXL|XL|L|M|S)\\b");
    private static final Pattern PRODUCT_CODE_PATTERN = Pattern.compile("(?iu)(?:mã|ma|code|sku)\\s*[:#\\-]?\\s*([A-Za-z0-9_\\-]+)");
    private static final Pattern PRICE_PATTERN = Pattern.compile("(?iu)(?:giá|gia|price)?\\s*[:\\-]?\\s*\\b(\\d{2,3}(?:[\\.,]\\d{3})*|\\d{2,3})\\s*(k|nghìn|nghin|đ|d|vnd)?\\b");
    private static final Pattern CUSTOMER_NAME_PATTERN = Pattern.compile("(?iu)(?:tên|ten|mình\\s+là|minh\\s+la|em\\s+là|em\\s+la|anh\\s+là|anh\\s+la|chị\\s+là|chi\\s+la)\\s*[:\\-]?\\s*([\\p{L}\\s]{2,60})");

    private static final Map<String, String> COLORS = new LinkedHashMap<>();

    static {
        COLORS.put("den", "đen");
        COLORS.put("trang", "trắng");
        COLORS.put("do", "đỏ");
        COLORS.put("xanh", "xanh");
        COLORS.put("vang", "vàng");
        COLORS.put("hong", "hồng");
        COLORS.put("nau", "nâu");
    }

    @Override
    public OrderInfoExtractedDto extractOrderInfo(List<Message> messages, Long shopId) {
        List<String> lines = messages == null ? List.of() : messages.stream()
                .filter(Objects::nonNull)
                .filter(message -> message.getSenderType() == null || message.getSenderType() == MessageSenderType.CUSTOMER)
                .map(Message::getText)
                .filter(StringUtils::hasText)
                .map(String::trim)
                .toList();

        String combinedText = String.join("\n", lines);
        String phone = findPhone(combinedText);
        Integer quantity = findQuantity(combinedText);
        String size = findSize(combinedText);
        String color = findColor(combinedText);
        String productName = findProductName(lines);
        String productCode = findProductCode(combinedText);
        String address = findAddress(lines);
        String customerName = findCustomerName(combinedText);
        BigDecimal price = findPrice(combinedText);

        List<String> missingFields = findMissingFields(productName, quantity, phone, address);
        log.debug("Rule-based order extraction completed. missingFields={}", missingFields);

        return OrderInfoExtractedDto.builder()
                .customerName(customerName)
                .phone(phone)
                .address(address)
                .productName(productName)
                .productCode(productCode)
                .quantity(quantity)
                .color(color)
                .size(size)
                .price(price)
                .note(null)
                .missingFields(missingFields)
                .build();
    }

    private String findPhone(String text) {
        Matcher matcher = PHONE_PATTERN.matcher(text);
        if (!matcher.find()) {
            return null;
        }

        String digits = matcher.group().replaceAll("[^0-9]", "");
        if (digits.startsWith("84") && digits.length() >= 11) {
            digits = "0" + digits.substring(2);
        }
        return digits;
    }

    private Integer findQuantity(String text) {
        Matcher byKeyword = QUANTITY_BY_KEYWORD_PATTERN.matcher(text);
        if (byKeyword.find()) {
            return Integer.parseInt(byKeyword.group(1));
        }

        Matcher byUnit = QUANTITY_BY_UNIT_PATTERN.matcher(text);
        if (byUnit.find()) {
            return Integer.parseInt(byUnit.group(1));
        }

        return null;
    }

    private String findSize(String text) {
        Matcher matcher = SIZE_PATTERN.matcher(text);
        return matcher.find() ? matcher.group(1).toUpperCase(Locale.ROOT) : null;
    }

    private String findColor(String text) {
        String normalized = normalize(text);
        for (Map.Entry<String, String> entry : COLORS.entrySet()) {
            if (Pattern.compile("\\b" + Pattern.quote(entry.getKey()) + "\\b").matcher(normalized).find()) {
                return entry.getValue();
            }
        }
        return null;
    }

    private String findProductName(List<String> lines) {
        for (String line : lines) {
            String normalized = normalize(line);
            if (containsAny(normalized, "mua", "dat", "lay", "can")) {
                return compact(line);
            }
        }

        return lines.stream()
                .filter(StringUtils::hasText)
                .findFirst()
                .map(this::compact)
                .orElse(null);
    }

    private String findProductCode(String text) {
        Matcher matcher = PRODUCT_CODE_PATTERN.matcher(text);
        return matcher.find() ? matcher.group(1).trim() : null;
    }

    private String findAddress(List<String> lines) {
        String address = null;
        for (String line : lines) {
            String normalized = normalize(line);
            if (containsAny(normalized, "ship", "dia chi", "giao", "nhan hang") || containsStandaloneO(normalized)) {
                address = compact(line);
            }
        }
        return address;
    }

    private String findCustomerName(String text) {
        Matcher matcher = CUSTOMER_NAME_PATTERN.matcher(text);
        if (!matcher.find()) {
            return null;
        }

        return compact(matcher.group(1));
    }

    private BigDecimal findPrice(String text) {
        Matcher matcher = PRICE_PATTERN.matcher(text);
        while (matcher.find()) {
            String suffix = matcher.group(2);
            if (!StringUtils.hasText(suffix) && matcher.group().trim().matches("\\d{2,3}")) {
                continue;
            }

            String rawNumber = matcher.group(1).replace(".", "").replace(",", "");
            BigDecimal value = new BigDecimal(rawNumber);
            String normalizedSuffix = suffix != null ? normalize(suffix) : "";
            if ("k".equals(normalizedSuffix) || "nghin".equals(normalizedSuffix)) {
                value = value.multiply(BigDecimal.valueOf(1000));
            }
            return value;
        }
        return null;
    }

    private List<String> findMissingFields(String productName, Integer quantity, String phone, String address) {
        List<String> missingFields = new ArrayList<>();
        if (!StringUtils.hasText(productName)) {
            missingFields.add("productName");
        }
        if (quantity == null) {
            missingFields.add("quantity");
        }
        if (!StringUtils.hasText(phone)) {
            missingFields.add("phone");
        }
        if (!StringUtils.hasText(address)) {
            missingFields.add("address");
        }
        return missingFields;
    }

    private boolean containsAny(String text, String... keywords) {
        for (String keyword : keywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private boolean containsStandaloneO(String text) {
        return Pattern.compile("(^|\\s)o\\s+").matcher(text).find();
    }

    private String compact(String value) {
        return value == null ? null : value.replaceAll("\\s+", " ").trim();
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }

        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('đ', 'd')
                .replace('Đ', 'D');
        return normalized.toLowerCase(Locale.ROOT);
    }
}

package com.oms.module.messenger.service;

import com.oms.module.messenger.dto.OrderInfoExtractedDto;
import com.oms.module.messenger.entity.Message;
import com.oms.module.messenger.enums.MessageSenderType;
import com.oms.module.order.entity.Order;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class RuleBasedOrderExtractionService implements OrderExtractionService {

    private static final ZoneId DEFAULT_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Pattern PHONE_PATTERN = Pattern.compile("(?<!\\d)(?:\\+?84|0)(?:[\\s.\\-]?\\d){8,10}(?!\\d)");
    private static final Pattern QUANTITY_BY_KEYWORD_PATTERN = Pattern.compile("(?iu)(?:số\\s*lượng|so\\s*luong|\\bsl\\b)\\s*[:\\-]?\\s*(\\d{1,4})");
    private static final Pattern QUANTITY_BY_UNIT_PATTERN = Pattern.compile("(?iu)\\b(\\d{1,4})\\s*(?:cái|cai|chiếc|chiec|sp|sản\\s*phẩm|san\\s*pham|bộ|bo)\\b");
    private static final Pattern RENTAL_DAYS_PATTERN = Pattern.compile("(?iu)\\b(\\d{1,3})\\s*(?:ngay|ngÃ y|day|days)\\b");
    private static final Pattern SIZE_PATTERN = Pattern.compile("(?iu)\\b(XXL|XL|L|M|S)\\b");
    private static final Pattern WORD_QUANTITY_BY_UNIT_PATTERN = Pattern.compile("(?iu)\\b(mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\\s*(?:cai|chiec|sp|san\\s*pham|bo)\\b");
    private static final Pattern PRODUCT_ID_INLINE_PATTERN = Pattern.compile("(?iu)\\bproduct\\s*id\\b\\s*[:#\\-]?\\s*(\\d{1,18})");
    private static final Pattern VARIANT_ID_INLINE_PATTERN = Pattern.compile("(?iu)\\bvariant\\s*id\\b\\s*[:#\\-]?\\s*(\\d{1,18})");
    private static final Pattern DATE_TOKEN_PATTERN = Pattern.compile("\\b(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?\\b");
    private static final Pattern PRODUCT_CODE_PATTERN = Pattern.compile("(?iu)(?:mã\\s*sản\\s*phẩm|ma\\s*san\\s*pham|product\\s*code|code)\\s*[:#\\-]?\\s*([A-Za-z0-9_\\-]+)");
    private static final Pattern SKU_PATTERN = Pattern.compile("(?iu)\\bsku\\b\\s*[:#\\-]?\\s*([A-Za-z0-9_\\-]+)");
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
                .filter(message -> message.getSenderType() == null || message.getSenderType() != MessageSenderType.SYSTEM)
                .map(Message::getText)
                .filter(StringUtils::hasText)
                .flatMap(text -> text.lines().map(String::trim))
                .filter(StringUtils::hasText)
                .toList();

        String combinedText = String.join("\n", lines);
        Order.OrderType orderType = firstNonNull(findStructuredOrderType(lines), findOrderType(combinedText));
        String phone = findPhone(combinedText);
        Integer quantity = firstNonNull(parsePositiveInteger(findStructuredValue(lines, "Số lượng", "So luong", "Quantity")), findQuantity(combinedText));
        String size = firstNonBlank(findStructuredValue(lines, "Size"), findSize(combinedText));
        String color = firstNonBlank(findStructuredValue(lines, "Màu", "Mau", "Color"), findColor(combinedText));
        String productName = findProductName(lines);
        String productCode = findProductCode(combinedText);
        String sku = firstNonBlank(findStructuredValue(lines, "SKU"), findSku(combinedText));
        Long productId = firstNonNull(
                parseLong(findStructuredValue(lines, "Product ID", "ProductId")),
                findInlineLong(combinedText, PRODUCT_ID_INLINE_PATTERN));
        Long variantId = firstNonNull(
                parseLong(findStructuredValue(lines, "Variant ID", "VariantId")),
                findInlineLong(combinedText, VARIANT_ID_INLINE_PATTERN));
        String address = findAddress(lines);
        String customerName = findCustomerName(combinedText);
        BigDecimal price = firstNonNull(
                parseAmount(findStructuredValue(lines, "Đơn giá", "Don gia", "Giá thuê", "Gia thue", "Unit price", "Rental price")),
                findAmountAfterKeywords(combinedText, List.of("tong", "tien thue", "gia")),
                findPrice(combinedText)
        );
        BigDecimal depositAmount = firstNonNull(
                parseAmount(findStructuredValue(lines, "Tiền cọc", "Tien coc", "Deposit")),
                findAmountAfterKeywords(combinedText, List.of("coc", "dat coc", "deposit"))
        );
        Integer rentalDays = firstNonNull(
                parsePositiveInteger(findStructuredValue(lines, "Số ngày thuê", "So ngay thue", "Rental days")),
                findRentalDays(combinedText)
        );
        LocalDate deliveryDate = firstNonNull(
                parseDate(findStructuredValue(lines,
                        "Ngày nhận",
                        "Ngay nhan",
                        "Ngày thuê từ",
                        "Ngay thue tu",
                        "Rent from",
                        "Delivery date"
                )),
                findDeliveryDate(combinedText)
        );
        LocalDate explicitRentTo = firstNonNull(
                parseDate(findStructuredValue(lines,
                "Ngày trả",
                "Ngay tra",
                "Ngày thuê đến",
                "Ngay thue den",
                "Rent to",
                "Return date"
        )),
                findReturnDate(combinedText));
        LocalDate rentFrom = orderType == Order.OrderType.RENT ? deliveryDate : null;
        LocalDate derivedRentTo = rentFrom != null && rentalDays != null
                ? rentFrom.plusDays(Math.max(rentalDays - 1, 0))
                : null;
        LocalDate rentTo = orderType == Order.OrderType.RENT
                ? firstNonNull(explicitRentTo, derivedRentTo)
                : null;
        rentalDays = firstNonNull(rentalDays, calculateRentalDays(rentFrom, rentTo));

        List<String> missingFields = findMissingFields(productName, quantity, phone, address, orderType, rentalDays, rentFrom, rentTo);
        log.debug("Rule-based order extraction completed. missingFields={}", missingFields);

        return OrderInfoExtractedDto.builder()
                .customerName(customerName)
                .phone(phone)
                .address(address)
                .orderType(orderType)
                .productId(productId)
                .variantId(variantId)
                .productName(productName)
                .productCode(productCode)
                .sku(sku)
                .quantity(quantity)
                .color(color)
                .size(size)
                .price(price)
                .depositAmount(depositAmount)
                .rentalDays(rentalDays)
                .deliveryDate(deliveryDate)
                .rentFrom(rentFrom)
                .rentTo(rentTo)
                .confidence(0.65)
                .note(null)
                .missingFields(missingFields)
                .items(StringUtils.hasText(productName)
                        ? List.of(OrderInfoExtractedDto.ItemDto.builder()
                                .productId(productId)
                                .variantId(variantId)
                                .productName(productName)
                                .productCode(productCode)
                                .sku(sku)
                                .variant(size)
                                .size(size)
                                .color(color)
                                .quantity(quantity)
                                .rentalDays(rentalDays)
                                .price(price)
                                .deposit(depositAmount)
                                .build())
                        : List.of())
                .build();
    }

    private String findStructuredValue(List<String> lines, String... labels) {
        if (lines == null || lines.isEmpty()) {
            return null;
        }

        List<String> normalizedLabels = List.of(labels).stream()
                .map(this::normalize)
                .toList();

        String matchedValue = null;
        for (String line : lines) {
            String cleaned = line == null ? "" : line.replaceFirst("^\\s*[-*]\\s*", "").trim();
            int separatorIndex = cleaned.indexOf(':');
            if (separatorIndex < 0) {
                continue;
            }

            String label = normalize(cleaned.substring(0, separatorIndex).trim());
            if (!normalizedLabels.contains(label)) {
                continue;
            }

            String value = cleaned.substring(separatorIndex + 1).trim();
            if (!isBlankStructuredValue(value)) {
                matchedValue = value;
            }
        }

        return matchedValue;
    }

    private boolean isBlankStructuredValue(String value) {
        if (!StringUtils.hasText(value)) {
            return true;
        }

        String normalized = normalize(value);
        return normalized.equals("--")
                || normalized.equals("null")
                || normalized.equals("n/a")
                || normalized.equals("na")
                || normalized.equals("khong")
                || normalized.equals("none");
    }

    private Order.OrderType findStructuredOrderType(List<String> lines) {
        String value = findStructuredValue(lines, "Loại đơn", "Loai don", "Order type");
        if (!StringUtils.hasText(value)) {
            return null;
        }

        String normalized = normalize(value);
        if (normalized.contains("rent") || normalized.contains("thue")) {
            return Order.OrderType.RENT;
        }
        if (normalized.contains("sell") || normalized.contains("ban")) {
            return Order.OrderType.SELL;
        }
        return null;
    }

    private Long parseLong(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return Long.parseLong(value.replaceAll("[^0-9]", ""));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Long findInlineLong(String text, Pattern pattern) {
        if (!StringUtils.hasText(text)) {
            return null;
        }

        Long matched = null;
        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            matched = parseLong(matcher.group(1));
        }
        return matched;
    }

    private Integer parsePositiveInteger(String value) {
        Long parsed = parseLong(value);
        if (parsed == null || parsed <= 0 || parsed > Integer.MAX_VALUE) {
            return null;
        }
        return parsed.intValue();
    }

    private BigDecimal parseAmount(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        Matcher matcher = Pattern.compile("(\\d[\\d.,]*)").matcher(value.replace(" ", ""));
        if (!matcher.find()) {
            return null;
        }

        String normalized = matcher.group(1).replace(".", "").replace(",", "");
        if (!StringUtils.hasText(normalized)) {
            return null;
        }

        try {
            return new BigDecimal(normalized);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private LocalDate parseDate(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (Exception ignored) {
            return null;
        }
    }

    private Integer calculateRentalDays(LocalDate rentFrom, LocalDate rentTo) {
        if (rentFrom == null || rentTo == null || rentTo.isBefore(rentFrom)) {
            return null;
        }
        long days = ChronoUnit.DAYS.between(rentFrom, rentTo) + 1;
        return days > 0 && days <= Integer.MAX_VALUE ? (int) days : null;
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

    private Order.OrderType findOrderType(String text) {
        String normalized = normalize(text);
        if (containsAny(normalized, "thue", "cho thue", "rental", "rent")) {
            return Order.OrderType.RENT;
        }
        if (containsAny(normalized, "ban", "mua", "sell")) {
            return Order.OrderType.SELL;
        }
        return null;
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

        Matcher byWordUnit = WORD_QUANTITY_BY_UNIT_PATTERN.matcher(normalize(text));
        if (byWordUnit.find()) {
            return parseVietnameseQuantityWord(byWordUnit.group(1));
        }

        return null;
    }

    private Integer parseVietnameseQuantityWord(String value) {
        return switch (value) {
            case "mot" -> 1;
            case "hai" -> 2;
            case "ba" -> 3;
            case "bon" -> 4;
            case "nam" -> 5;
            case "sau" -> 6;
            case "bay" -> 7;
            case "tam" -> 8;
            case "chin" -> 9;
            case "muoi" -> 10;
            default -> null;
        };
    }

    private Integer findRentalDays(String text) {
        Matcher matcher = RENTAL_DAYS_PATTERN.matcher(normalize(text));
        return matcher.find() ? Integer.parseInt(matcher.group(1)) : null;
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
        String structured = findStructuredValue(lines, "Tên sản phẩm", "Ten san pham", "Product name");
        if (StringUtils.hasText(structured)) {
            return compact(structured);
        }

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

    private String findSku(String text) {
        Matcher matcher = SKU_PATTERN.matcher(text);
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

    private LocalDate findDeliveryDate(String text) {
        String normalized = normalize(text);
        LocalDate today = LocalDate.now(DEFAULT_ZONE);
        if (containsAny(normalized, "hom nay", "today")) {
            return today;
        }
        if (containsAny(normalized, "ngay mai", "mai", "tomorrow")) {
            return today.plusDays(1);
        }

        List<LocalDate> dates = findDateCandidates(text);
        return dates.isEmpty() ? null : dates.get(0);
    }

    private LocalDate findReturnDate(String text) {
        List<LocalDate> dates = findDateCandidates(text);
        return dates.size() >= 2 ? dates.get(1) : null;
    }

    private List<LocalDate> findDateCandidates(String text) {
        if (!StringUtils.hasText(text)) {
            return List.of();
        }

        List<LocalDate> dates = new ArrayList<>();
        Matcher isoMatcher = Pattern.compile("\\b\\d{4}-\\d{2}-\\d{2}\\b").matcher(text);
        while (isoMatcher.find()) {
            dates.add(LocalDate.parse(isoMatcher.group()));
        }

        Matcher dmyMatcher = DATE_TOKEN_PATTERN.matcher(text);
        while (dmyMatcher.find()) {
            parseDateToken(dmyMatcher).ifPresent(dates::add);
        }
        return dates;
    }

    private Optional<LocalDate> parseDateToken(Matcher matcher) {
        try {
            int day = Integer.parseInt(matcher.group(1));
            int month = Integer.parseInt(matcher.group(2));
            String rawYear = matcher.group(3);
            LocalDate today = LocalDate.now(DEFAULT_ZONE);
            int year = StringUtils.hasText(rawYear)
                    ? Integer.parseInt(rawYear)
                    : today.getYear();
            if (year < 100) {
                year += 2000;
            }

            LocalDate date = LocalDate.of(year, month, day);
            if (!StringUtils.hasText(rawYear) && date.isBefore(today.minusDays(1))) {
                date = date.plusYears(1);
            }
            return Optional.of(date);
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    private BigDecimal findAmountAfterKeywords(String text, List<String> keywords) {
        String normalized = normalize(text);
        for (String keyword : keywords) {
            int index = normalized.indexOf(keyword);
            if (index < 0) {
                continue;
            }

            String tail = text.substring(Math.min(text.length(), index));
            BigDecimal amount = findPrice(tail);
            if (amount != null) {
                return amount;
            }
        }
        return null;
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

    private List<String> findMissingFields(
            String productName,
            Integer quantity,
            String phone,
            String address,
            Order.OrderType orderType,
            Integer rentalDays,
            LocalDate rentFrom,
            LocalDate rentTo
    ) {
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
        if (orderType == null) {
            missingFields.add("orderType");
        }
        if (orderType == Order.OrderType.RENT) {
            if (rentalDays == null) {
                missingFields.add("rentalDays");
            }
            if (rentFrom == null || rentTo == null) {
                missingFields.add("rentDates");
            }
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

    @SafeVarargs
    private final <T> T firstNonNull(T... values) {
        if (values == null) {
            return null;
        }
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }

        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('\u0111', 'd')
                .replace('\u0110', 'D')
                .replace('đ', 'd')
                .replace('Đ', 'D');
        return normalized.toLowerCase(Locale.ROOT);
    }
}

package com.oms.module.order.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.config.GeminiProperties;
import com.oms.module.order.dto.AiParseRequest;
import com.oms.module.order.dto.AiParseResponse;
import com.oms.module.order.entity.Order;
import com.oms.module.orderform.entity.OrderFormConfig;
import com.oms.module.orderform.entity.OrderFormCustomField;
import com.oms.module.orderform.entity.OrderFormFieldOption;
import com.oms.module.orderform.repository.OrderFormConfigRepository;
import com.oms.module.product.entity.ProductType;
import com.oms.module.shop.entity.ShopOrderSource;
import com.oms.module.shop.entity.ShopShippingMethod;
import com.oms.module.shop.repository.ShopOrderSourceRepository;
import com.oms.module.shop.repository.ShopShippingMethodRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderAiParseService {

    private static final ZoneId DEFAULT_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Pattern PHONE_PATTERN = Pattern.compile("(?:\\+84|84|0)(?:[\\s.-]*\\d){8,10}");
    private static final Pattern DATE_ISO_PATTERN = Pattern.compile("\\b\\d{4}-\\d{2}-\\d{2}\\b");
    private static final Pattern DATE_DDMMYYYY_PATTERN = Pattern.compile("\\b(\\d{1,2})/(\\d{1,2})/(\\d{4})\\b");
    private static final Pattern NUMBER_PATTERN = Pattern.compile("(-?\\d[\\d.,]*)");

    private final GeminiProperties geminiProperties;
    private final ObjectMapper objectMapper;
    private final ShopShippingMethodRepository shippingMethodRepository;
    private final ShopOrderSourceRepository orderSourceRepository;
    private final OrderFormConfigRepository orderFormConfigRepository;

    @Transactional(readOnly = true)
    public AiParseResponse parse(Long shopId, AiParseRequest request) {
        ParseContext context = buildContext(shopId, request.getOrderTypeHint());
        AiParseResponse fallbackDraft = buildFallbackDraft(request.getRawText(), request.getOrderTypeHint(), context);

        if (!StringUtils.hasText(geminiProperties.getApiKey())) {
            log.info("Skipping Gemini order parse because GEMINI_API_KEY is not configured");
            return fallbackDraft;
        }

        try {
            AiParseResponse aiDraft = requestGemini(request, context);
            return mergeDrafts(fallbackDraft, aiDraft, request.getOrderTypeHint(), context);
        } catch (RestClientException | JsonProcessingException ex) {
            log.warn("Gemini order parse failed. Falling back to heuristic parser. reason={}", ex.getMessage());
            return fallbackDraft;
        }
    }

    private ParseContext buildContext(Long shopId, Order.OrderType orderTypeHint) {
        if (shopId == null) {
            return new ParseContext(List.of(), List.of(), List.of());
        }

        List<String> orderSources = orderSourceRepository.findByShopIdAndIsActiveTrue(shopId).stream()
                .map(ShopOrderSource::getName)
                .filter(StringUtils::hasText)
                .toList();

        List<ShippingMethodContext> shippingMethods = shippingMethodRepository.findByShopIdAndIsActiveTrue(shopId).stream()
                .map(method -> new ShippingMethodContext(
                        method.getName(),
                        method.getFeePolicy(),
                        method.getDefaultFee() == null ? BigDecimal.ZERO : method.getDefaultFee()
                ))
                .toList();

        return new ParseContext(orderSources, shippingMethods, loadCustomFields(shopId, orderTypeHint));
    }

    private List<CustomFieldContext> loadCustomFields(Long shopId, Order.OrderType orderTypeHint) {
        ProductType formType = mapToFormType(orderTypeHint);
        if (formType == null) {
            return List.of();
        }

        return orderFormConfigRepository.findAllByShopIdAndFormType(shopId, formType).stream()
                .findFirst()
                .map(OrderFormConfig::getCustomFields)
                .stream()
                .flatMap(List::stream)
                .filter(field -> Boolean.TRUE.equals(field.getIsActive()))
                .map(this::toCustomFieldContext)
                .toList();
    }

    private ProductType mapToFormType(Order.OrderType orderTypeHint) {
        if (orderTypeHint == null) {
            return null;
        }
        return orderTypeHint == Order.OrderType.RENT ? ProductType.RENT : ProductType.SELL;
    }

    private CustomFieldContext toCustomFieldContext(OrderFormCustomField field) {
        List<String> options = field.getOptions().stream()
                .filter(option -> Boolean.TRUE.equals(option.getIsActive()))
                .map(OrderFormFieldOption::getLabel)
                .filter(StringUtils::hasText)
                .toList();

        return new CustomFieldContext(
                field.getFieldKey(),
                field.getLabel(),
                field.getFieldType(),
                Boolean.TRUE.equals(field.getIsRequired()),
                options
        );
    }

    private AiParseResponse requestGemini(AiParseRequest request, ParseContext context) throws JsonProcessingException {
        RestClient client = RestClient.builder().baseUrl(geminiProperties.getBaseUrl()).build();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("contents", List.of(
                Map.of("parts", List.of(Map.of("text", buildPrompt(request, context))))
        ));
        payload.put("generationConfig", Map.of(
                "temperature", 0.1,
                "responseMimeType", "application/json",
                "responseJsonSchema", buildResponseSchema()
        ));

        JsonNode response = client.post()
                .uri("/models/{model}:generateContent", geminiProperties.getModel())
                .contentType(MediaType.APPLICATION_JSON)
                .header("x-goog-api-key", geminiProperties.getApiKey())
                .body(payload)
                .retrieve()
                .body(JsonNode.class);

        if (response == null) {
            throw new JsonProcessingException("Gemini returned an empty response") {
            };
        }

        String jsonText = extractResponseText(response);
        String sanitizedJson = stripCodeFence(jsonText);
        AiParseResponse aiDraft = objectMapper.readValue(sanitizedJson, AiParseResponse.class);
        return sanitizeDraft(aiDraft, request.getOrderTypeHint(), context);
    }

    private String extractResponseText(JsonNode response) throws JsonProcessingException {
        JsonNode candidates = response.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            throw new JsonProcessingException("Gemini response does not contain candidates") {
            };
        }

        JsonNode parts = candidates.get(0).path("content").path("parts");
        if (!parts.isArray() || parts.isEmpty()) {
            throw new JsonProcessingException("Gemini response does not contain content parts") {
            };
        }

        StringBuilder builder = new StringBuilder();
        for (JsonNode part : parts) {
            String text = trimToNull(part.path("text").asText(null));
            if (text != null) {
                builder.append(text);
            }
        }

        if (builder.isEmpty()) {
            throw new JsonProcessingException("Gemini response content is empty") {
            };
        }

        return builder.toString();
    }

    private String stripCodeFence(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.startsWith("```")) {
            int firstLineBreak = value.indexOf('\n');
            if (firstLineBreak >= 0) {
                value = value.substring(firstLineBreak + 1);
            }
            if (value.endsWith("```")) {
                value = value.substring(0, value.length() - 3);
            }
        }
        return value.trim();
    }

    private Map<String, Object> buildResponseSchema() {
        List<String> requiredFields = List.of(
                "orderType",
                "customerName",
                "customerPhone",
                "customerAddress",
                "customerNote",
                "sourceChannel",
                "shippingMethod",
                "shippingFee",
                "rentFrom",
                "rentTo",
                "depositPaid",
                "products",
                "customFields"
        );

        Map<String, Object> productSchema = new LinkedHashMap<>();
        productSchema.put("type", "object");
        productSchema.put("additionalProperties", false);
        productSchema.put("properties", Map.of(
                "productId", Map.of("type", List.of("integer", "null")),
                "variantId", Map.of("type", List.of("integer", "null")),
                "productCode", Map.of("type", List.of("string", "null")),
                "sku", Map.of("type", List.of("string", "null")),
                "name", Map.of("type", "string"),
                "color", Map.of("type", List.of("string", "null")),
                "size", Map.of("type", List.of("string", "null")),
                "quantity", Map.of("type", List.of("integer", "null")),
                "unitPrice", Map.of("type", List.of("number", "null"))
        ));
        productSchema.put("required", List.of(
                "productId",
                "variantId",
                "productCode",
                "sku",
                "name",
                "color",
                "size",
                "quantity",
                "unitPrice"
        ));

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("orderType", Map.of(
                "type", List.of("string", "null"),
                "description", "Return SELL, RENT or null"
        ));
        properties.put("customerName", Map.of("type", List.of("string", "null")));
        properties.put("customerPhone", Map.of("type", List.of("string", "null")));
        properties.put("customerAddress", Map.of("type", List.of("string", "null")));
        properties.put("customerNote", Map.of("type", List.of("string", "null")));
        properties.put("sourceChannel", Map.of("type", List.of("string", "null")));
        properties.put("shippingMethod", Map.of("type", List.of("string", "null")));
        properties.put("shippingFee", Map.of("type", List.of("number", "null")));
        properties.put("rentFrom", Map.of("type", List.of("string", "null"), "format", "date"));
        properties.put("rentTo", Map.of("type", List.of("string", "null"), "format", "date"));
        properties.put("depositPaid", Map.of("type", List.of("number", "null")));
        properties.put("products", Map.of("type", "array", "items", productSchema));
        properties.put("customFields", Map.of(
                "type", List.of("object", "null"),
                "additionalProperties", true
        ));

        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("additionalProperties", false);
        schema.put("properties", properties);
        schema.put("required", requiredFields);
        return schema;
    }

    private String buildPrompt(AiParseRequest request, ParseContext context) {
        String orderTypeHint = request.getOrderTypeHint() == null ? "none" : request.getOrderTypeHint().name();
        String orderSources = context.orderSources().isEmpty()
                ? "No predefined order sources"
                : String.join(", ", context.orderSources());
        String shippingMethods = context.shippingMethods().isEmpty()
                ? "No predefined shipping methods"
                : context.shippingMethods().stream()
                .map(method -> String.format(
                        Locale.ROOT,
                        "%s (policy=%s, defaultFee=%s)",
                        method.name(),
                        method.feePolicy(),
                        method.defaultFee().toPlainString()
                ))
                .collect(Collectors.joining(", "));
        String customFields = context.customFields().isEmpty()
                ? "No custom fields"
                : context.customFields().stream()
                .map(field -> String.format(
                        Locale.ROOT,
                        "%s [label=%s, type=%s, required=%s, options=%s]",
                        field.fieldKey(),
                        field.label(),
                        field.fieldType(),
                        field.required(),
                        field.options().isEmpty() ? "[]" : field.options()
                ))
                .collect(Collectors.joining("\n"));

        return """
                You extract structured order draft data from customer chat messages for a Vietnam order management system.
                The source text can be Vietnamese, English, or mixed.
                Today in Asia/Ho_Chi_Minh is %s.

                Rules:
                - Return only valid JSON that matches the provided schema.
                - If a field is missing or uncertain, return null. Use [] for products when none are clear.
                - Normalize customerPhone to digits only. Convert 84-prefixed Vietnam numbers to 0-prefixed local format when possible.
                - If the text contains relative dates like "tomorrow" or "ngay mai", resolve them against today's date.
                - Use orderTypeHint when present unless the text clearly contradicts it.
                - If sourceChannel matches one of the configured order sources, return the exact configured name. Otherwise return null.
                - If shippingMethod matches one of the configured shipping methods, return the exact configured name. Otherwise return null.
                - If customFields are present, use fieldKey as the object key. For multi choice values, return an array of strings.
                - Keep customerNote concise and only include meaningful information not already captured elsewhere.
                - Product blocks copied from OMS are authoritative. Preserve Product ID, Variant ID and SKU exactly when present.
                - If there are multiple OMS product blocks in the text, use the latest/last OMS product block for product data.
                - For rental product blocks, use "Ngay nhan"/"Ngay thue tu" as rentFrom and "Ngay tra"/"Ngay thue den" as rentTo.

                orderTypeHint: %s
                configuredOrderSources: %s
                configuredShippingMethods: %s
                configuredCustomFields:
                %s

                customerMessage:
                %s
                """.formatted(
                LocalDate.now(DEFAULT_ZONE),
                orderTypeHint,
                orderSources,
                shippingMethods,
                customFields,
                request.getRawText()
        );
    }

    private AiParseResponse buildFallbackDraft(String rawText, Order.OrderType orderTypeHint, ParseContext context) {
        List<String> lines = Arrays.stream(rawText.split("\\r?\\n"))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .toList();

        return sanitizeDraft(AiParseResponse.builder()
                .orderType(resolveOrderType(orderTypeHint, detectOrderType(rawText)))
                .customerName(findByPrefixes(lines, List.of(
                        "ten",
                        "ten khach",
                        "khach hang",
                        "customer",
                        "nguoi nhan",
                        "ten nguoi nhan"
                )))
                .customerPhone(normalizePhone(extractPhone(rawText)))
                .customerAddress(firstNonBlank(
                        findByPrefixes(lines, List.of("dia chi", "d/c", "dc", "address", "ship toi", "giao toi")),
                        extractAfterKeyword(rawText, List.of("dia chi", "d/c", "dc", "ship toi", "giao toi"))
                ))
                .customerNote(findByPrefixes(lines, List.of("ghi chu", "note", "luu y")))
                .sourceChannel(matchConfiguredValue(rawText, context.orderSources()))
                .shippingMethod(matchShippingMethod(rawText, context.shippingMethods()))
                .shippingFee(findAmount(lines, List.of("phi ship", "ship", "shipping fee")))
                .rentFrom(normalizeDateCandidate(findByPrefixes(lines, List.of(
                        "ngay nhan",
                        "ngay thue tu",
                        "rent from",
                        "tu ngay"
                ))))
                .rentTo(normalizeDateCandidate(findByPrefixes(lines, List.of(
                        "ngay tra",
                        "ngay thue den",
                        "rent to",
                        "den ngay"
                ))))
                .depositPaid(findAmount(lines, List.of("tien coc", "dat coc", "deposit")))
                .products(parseProductsFromLines(lines))
                .customFields(parseCustomFields(lines, context.customFields()))
                .build(), orderTypeHint, context);
    }

    private Order.OrderType detectOrderType(String rawText) {
        String normalized = normalizeLookup(rawText);
        if (normalized.contains("cho thue") || normalized.contains("thue")) {
            return Order.OrderType.RENT;
        }
        if (normalized.contains("ban")) {
            return Order.OrderType.SELL;
        }
        return null;
    }

    private String extractPhone(String rawText) {
        Matcher matcher = PHONE_PATTERN.matcher(rawText);
        if (matcher.find()) {
            return matcher.group();
        }
        return null;
    }

    private String extractAfterKeyword(String rawText, List<String> keywords) {
        for (String line : rawText.split("\\r?\\n")) {
            String normalizedLine = normalizeLookup(line);
            for (String keyword : keywords) {
                String normalizedKeyword = normalizeLookup(keyword);
                int idx = normalizedLine.indexOf(normalizedKeyword);
                if (idx >= 0) {
                    String value = line.substring(Math.min(line.length(), idx + keyword.length()))
                            .replaceFirst("^[\\s:,-]+", "");
                    String trimmed = trimToNull(value);
                    if (trimmed != null) {
                        return trimmed;
                    }
                }
            }
        }
        return null;
    }

    private Map<String, Object> parseCustomFields(List<String> lines, List<CustomFieldContext> fields) {
        if (fields.isEmpty()) {
            return null;
        }

        Map<String, Object> values = new LinkedHashMap<>();
        for (CustomFieldContext field : fields) {
            String rawValue = firstNonBlank(
                    findByPrefixes(lines, List.of(field.fieldKey(), field.label())),
                    findLineContainingLabel(lines, field.label())
            );

            if (!StringUtils.hasText(rawValue)) {
                continue;
            }

            if (isMultiChoiceField(field.fieldType())) {
                List<String> selectedValues = Arrays.stream(rawValue.split("[,;/]"))
                        .map(String::trim)
                        .filter(StringUtils::hasText)
                        .map(value -> matchConfiguredValue(value, field.options()))
                        .filter(Objects::nonNull)
                        .distinct()
                        .toList();

                if (!selectedValues.isEmpty()) {
                    values.put(field.fieldKey(), selectedValues);
                }
                continue;
            }

            if (requiresOptionMatch(field.fieldType()) && !field.options().isEmpty()) {
                String matchedValue = matchConfiguredValue(rawValue, field.options());
                if (matchedValue != null) {
                    values.put(field.fieldKey(), matchedValue);
                }
                continue;
            }

            values.put(field.fieldKey(), rawValue.trim());
        }

        return values.isEmpty() ? null : values;
    }

    private String findLineContainingLabel(List<String> lines, String label) {
        String normalizedLabel = normalizeLookup(label);
        for (String line : lines) {
            String normalizedLine = normalizeLookup(line);
            if (normalizedLine.startsWith(normalizedLabel + " ")) {
                return trimToNull(line.substring(Math.min(line.length(), label.length()))
                        .replaceFirst("^[\\s:,-]+", ""));
            }
        }
        return null;
    }

    private boolean isMultiChoiceField(String fieldType) {
        return "multi_choice".equalsIgnoreCase(fieldType);
    }

    private boolean requiresOptionMatch(String fieldType) {
        return "single_choice".equalsIgnoreCase(fieldType) || "dropdown".equalsIgnoreCase(fieldType);
    }

    private List<AiParseResponse.ProductDraft> parseProductsFromLines(List<String> lines) {
        List<AiParseResponse.ProductDraft> products = new ArrayList<>();

        for (String line : lines) {
            String normalized = normalizeLookup(line);
            if (normalized.startsWith("ten")
                    || normalized.startsWith("khach hang")
                    || normalized.startsWith("customer")
                    || normalized.startsWith("sdt")
                    || normalized.startsWith("so dien thoai")
                    || normalized.startsWith("dia chi")
                    || normalized.startsWith("ghi chu")) {
                continue;
            }

            List<String> segments = Arrays.stream(line.split("[|;]"))
                    .map(String::trim)
                    .filter(StringUtils::hasText)
                    .toList();

            if (segments.size() < 3) {
                continue;
            }

            String name = trimToNull(segments.get(0));
            if (name == null) {
                continue;
            }

            products.add(AiParseResponse.ProductDraft.builder()
                    .name(name)
                    .size(trimToNull(segments.get(1)))
                    .quantity(toPositiveInteger(segments.get(2), 1))
                    .unitPrice(segments.size() >= 4 ? toPositiveBigDecimal(segments.get(3)) : null)
                    .build());
        }

        return products;
    }

    private Integer toPositiveInteger(String rawValue, int fallback) {
        BigDecimal number = parseNumber(rawValue);
        if (number == null) {
            return fallback;
        }
        return Math.max(1, number.intValue());
    }

    private BigDecimal toPositiveBigDecimal(String rawValue) {
        BigDecimal number = parseNumber(rawValue);
        if (number == null) {
            return null;
        }
        return number.max(BigDecimal.ZERO);
    }

    private BigDecimal findAmount(List<String> lines, List<String> prefixes) {
        String rawValue = findByPrefixes(lines, prefixes);
        if (!StringUtils.hasText(rawValue)) {
            return null;
        }
        BigDecimal number = parseNumber(rawValue);
        return number == null ? null : number.max(BigDecimal.ZERO);
    }

    private BigDecimal parseNumber(String rawValue) {
        if (!StringUtils.hasText(rawValue)) {
            return null;
        }

        Matcher matcher = NUMBER_PATTERN.matcher(rawValue.replace(" ", ""));
        if (!matcher.find()) {
            return null;
        }

        String normalized = matcher.group(1).replace(",", "").replace(".", "");
        if (!StringUtils.hasText(normalized)) {
            return null;
        }

        try {
            return new BigDecimal(normalized);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String normalizeDateCandidate(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            return null;
        }

        Matcher isoMatcher = DATE_ISO_PATTERN.matcher(trimmed);
        if (isoMatcher.find()) {
            return isoMatcher.group();
        }

        Matcher dmyMatcher = DATE_DDMMYYYY_PATTERN.matcher(trimmed);
        if (dmyMatcher.find()) {
            String day = dmyMatcher.group(1).length() == 1 ? "0" + dmyMatcher.group(1) : dmyMatcher.group(1);
            String month = dmyMatcher.group(2).length() == 1 ? "0" + dmyMatcher.group(2) : dmyMatcher.group(2);
            return dmyMatcher.group(3) + "-" + month + "-" + day;
        }

        return null;
    }

    private String matchShippingMethod(String rawValue, List<ShippingMethodContext> shippingMethods) {
        return matchConfiguredValue(rawValue, shippingMethods.stream().map(ShippingMethodContext::name).toList());
    }

    private String matchConfiguredValue(String rawValue, List<String> candidates) {
        String normalizedInput = normalizeLookup(rawValue);
        if (!StringUtils.hasText(normalizedInput) || candidates.isEmpty()) {
            return null;
        }

        for (String candidate : candidates) {
            String normalizedCandidate = normalizeLookup(candidate);
            if (normalizedInput.contains(normalizedCandidate) || normalizedCandidate.contains(normalizedInput)) {
                return candidate;
            }
        }

        return null;
    }

    private String findByPrefixes(List<String> lines, List<String> prefixes) {
        List<String> normalizedPrefixes = prefixes.stream()
                .map(this::normalizeLookup)
                .toList();

        for (String line : lines) {
            String normalizedLine = normalizeLookup(line);
            for (String prefix : normalizedPrefixes) {
                if (normalizedLine.startsWith(prefix + ":")
                        || normalizedLine.startsWith(prefix + " -")
                        || normalizedLine.startsWith(prefix + " ")
                        || normalizedLine.equals(prefix)) {
                    String value = line.replaceFirst("^[^:.-]+[:.-]?", "").trim();
                    if (StringUtils.hasText(value)) {
                        return value;
                    }
                }
            }
        }

        return null;
    }

    private AiParseResponse mergeDrafts(
            AiParseResponse fallbackDraft,
            AiParseResponse aiDraft,
            Order.OrderType orderTypeHint,
            ParseContext context
    ) {
        return sanitizeDraft(AiParseResponse.builder()
                .orderType(resolveOrderType(orderTypeHint, firstNonNull(aiDraft.getOrderType(), fallbackDraft.getOrderType())))
                .customerName(firstNonBlank(aiDraft.getCustomerName(), fallbackDraft.getCustomerName()))
                .customerPhone(firstNonBlank(aiDraft.getCustomerPhone(), fallbackDraft.getCustomerPhone()))
                .customerAddress(firstNonBlank(aiDraft.getCustomerAddress(), fallbackDraft.getCustomerAddress()))
                .customerNote(firstNonBlank(aiDraft.getCustomerNote(), fallbackDraft.getCustomerNote()))
                .sourceChannel(firstNonBlank(aiDraft.getSourceChannel(), fallbackDraft.getSourceChannel()))
                .shippingMethod(firstNonBlank(aiDraft.getShippingMethod(), fallbackDraft.getShippingMethod()))
                .shippingFee(firstNonNull(aiDraft.getShippingFee(), fallbackDraft.getShippingFee()))
                .rentFrom(firstNonBlank(aiDraft.getRentFrom(), fallbackDraft.getRentFrom()))
                .rentTo(firstNonBlank(aiDraft.getRentTo(), fallbackDraft.getRentTo()))
                .depositPaid(firstNonNull(aiDraft.getDepositPaid(), fallbackDraft.getDepositPaid()))
                .products(aiDraft.getProducts() == null || aiDraft.getProducts().isEmpty()
                        ? fallbackDraft.getProducts()
                        : aiDraft.getProducts())
                .customFields(aiDraft.getCustomFields() == null || aiDraft.getCustomFields().isEmpty()
                        ? fallbackDraft.getCustomFields()
                        : aiDraft.getCustomFields())
                .build(), orderTypeHint, context);
    }

    private AiParseResponse sanitizeDraft(
            AiParseResponse draft,
            Order.OrderType orderTypeHint,
            ParseContext context
    ) {
        if (draft == null) {
            return AiParseResponse.builder().build();
        }

        Order.OrderType resolvedOrderType = resolveOrderType(orderTypeHint, draft.getOrderType());
        String sourceChannel = context.orderSources().isEmpty()
                ? trimToNull(draft.getSourceChannel())
                : matchConfiguredValue(draft.getSourceChannel(), context.orderSources());
        String shippingMethod = context.shippingMethods().isEmpty()
                ? trimToNull(draft.getShippingMethod())
                : matchShippingMethod(draft.getShippingMethod(), context.shippingMethods());
        Map<String, Object> customFields = sanitizeCustomFields(draft.getCustomFields(), context.customFields());
        List<AiParseResponse.ProductDraft> products = sanitizeProducts(draft.getProducts());

        return AiParseResponse.builder()
                .orderType(resolvedOrderType)
                .customerName(trimToNull(draft.getCustomerName()))
                .customerPhone(normalizePhone(draft.getCustomerPhone()))
                .customerAddress(trimToNull(draft.getCustomerAddress()))
                .customerNote(trimToNull(draft.getCustomerNote()))
                .sourceChannel(sourceChannel)
                .shippingMethod(shippingMethod)
                .shippingFee(toNonNegative(draft.getShippingFee()))
                .rentFrom(normalizeDateCandidate(draft.getRentFrom()))
                .rentTo(normalizeDateCandidate(draft.getRentTo()))
                .depositPaid(toNonNegative(draft.getDepositPaid()))
                .products(products.isEmpty() ? null : products)
                .customFields(customFields == null || customFields.isEmpty() ? null : customFields)
                .build();
    }

    private List<AiParseResponse.ProductDraft> sanitizeProducts(List<AiParseResponse.ProductDraft> products) {
        if (products == null || products.isEmpty()) {
            return List.of();
        }

        return products.stream()
                .filter(Objects::nonNull)
                .map(product -> AiParseResponse.ProductDraft.builder()
                        .productId(product.getProductId())
                        .variantId(product.getVariantId())
                        .productCode(trimToNull(product.getProductCode()))
                        .sku(trimToNull(product.getSku()))
                        .name(trimToNull(product.getName()))
                        .color(trimToNull(product.getColor()))
                        .size(firstNonBlank(product.getSize(), "Free"))
                        .quantity(product.getQuantity() == null ? 1 : Math.max(1, product.getQuantity()))
                        .unitPrice(toNonNegative(product.getUnitPrice()))
                        .build())
                .filter(product -> StringUtils.hasText(product.getName()))
                .toList();
    }

    private Map<String, Object> sanitizeCustomFields(
            Map<String, Object> parsedCustomFields,
            List<CustomFieldContext> customFieldContexts
    ) {
        if (parsedCustomFields == null || parsedCustomFields.isEmpty()) {
            return null;
        }

        if (customFieldContexts.isEmpty()) {
            return parsedCustomFields;
        }

        Map<String, Object> normalizedLookup = new LinkedHashMap<>();
        parsedCustomFields.forEach((key, value) -> normalizedLookup.put(normalizeLookup(key), value));

        Map<String, Object> sanitized = new LinkedHashMap<>();
        for (CustomFieldContext field : customFieldContexts) {
            Object rawValue = firstNonNull(
                    normalizedLookup.get(normalizeLookup(field.fieldKey())),
                    normalizedLookup.get(normalizeLookup(field.label()))
            );

            if (rawValue == null) {
                continue;
            }

            if (isMultiChoiceField(field.fieldType())) {
                List<String> values = toStringList(rawValue).stream()
                        .map(value -> matchConfiguredValue(value, field.options()))
                        .filter(Objects::nonNull)
                        .distinct()
                        .toList();
                if (!values.isEmpty()) {
                    sanitized.put(field.fieldKey(), values);
                }
                continue;
            }

            String normalizedValue = trimToNull(String.valueOf(rawValue));
            if (!StringUtils.hasText(normalizedValue)) {
                continue;
            }

            if (requiresOptionMatch(field.fieldType()) && !field.options().isEmpty()) {
                normalizedValue = matchConfiguredValue(normalizedValue, field.options());
            }

            if (normalizedValue != null) {
                sanitized.put(field.fieldKey(), normalizedValue);
            }
        }

        return sanitized;
    }

    private List<String> toStringList(Object rawValue) {
        if (rawValue instanceof List<?> rawList) {
            return rawList.stream()
                    .filter(Objects::nonNull)
                    .map(String::valueOf)
                    .map(String::trim)
                    .filter(StringUtils::hasText)
                    .toList();
        }

        return Arrays.stream(String.valueOf(rawValue).split("[,;/]"))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .toList();
    }

    private Order.OrderType resolveOrderType(Order.OrderType hint, Order.OrderType detected) {
        return hint != null ? hint : detected;
    }

    private BigDecimal toNonNegative(BigDecimal value) {
        if (value == null) {
            return null;
        }
        return value.max(BigDecimal.ZERO);
    }

    private String normalizePhone(String rawValue) {
        String digits = rawValue == null ? "" : rawValue.replaceAll("\\D", "");
        if (!StringUtils.hasText(digits)) {
            return null;
        }

        if (digits.startsWith("84") && digits.length() >= 11) {
            digits = "0" + digits.substring(2);
        }

        if (digits.length() > 11 && digits.startsWith("0")) {
            digits = digits.substring(0, 11);
        }

        return digits;
    }

    private String normalizeLookup(String value) {
        if (value == null) {
            return "";
        }

        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .trim();

        return normalized.replaceAll("\\s+", " ");
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private <T> T firstNonNull(T first, T second) {
        return first != null ? first : second;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String trimmed = trimToNull(value);
            if (trimmed != null) {
                return trimmed;
            }
        }
        return null;
    }

    private record ParseContext(
            List<String> orderSources,
            List<ShippingMethodContext> shippingMethods,
            List<CustomFieldContext> customFields
    ) {
    }

    private record ShippingMethodContext(
            String name,
            ShopShippingMethod.FeePolicy feePolicy,
            BigDecimal defaultFee
    ) {
    }

    private record CustomFieldContext(
            String fieldKey,
            String label,
            String fieldType,
            boolean required,
            List<String> options
    ) {
    }
}

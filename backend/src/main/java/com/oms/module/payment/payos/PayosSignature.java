package com.oms.module.payment.payos;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

public final class PayosSignature {

    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private PayosSignature() {
    }

    public static String signCreatePayment(
            Long amount,
            String cancelUrl,
            String description,
            Long orderCode,
            String returnUrl,
            String checksumKey
    ) {
        String data = "amount=" + amount
                + "&cancelUrl=" + cancelUrl
                + "&description=" + description
                + "&orderCode=" + orderCode
                + "&returnUrl=" + returnUrl;
        return hmacSha256(data, checksumKey);
    }

    public static boolean verifyWebhookData(
            Map<String, Object> data,
            String signature,
            String checksumKey,
            ObjectMapper objectMapper
    ) {
        if (data == null || !StringUtils.hasText(signature) || !StringUtils.hasText(checksumKey)) {
            return false;
        }

        String query = toSignatureQuery(data, objectMapper);
        String expected = hmacSha256(query, checksumKey);
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                signature.getBytes(StandardCharsets.UTF_8)
        );
    }

    private static String toSignatureQuery(Map<String, Object> data, ObjectMapper objectMapper) {
        Map<String, Object> sorted = new TreeMap<>(data);
        List<String> parts = new ArrayList<>();
        sorted.forEach((key, value) -> parts.add(key + "=" + stringify(value, objectMapper)));
        return String.join("&", parts);
    }

    @SuppressWarnings("unchecked")
    private static String stringify(Object value, ObjectMapper objectMapper) {
        if (value == null || "undefined".equals(value) || "null".equals(value)) {
            return "";
        }

        if (value instanceof BigDecimal bigDecimal) {
            return bigDecimal.stripTrailingZeros().toPlainString();
        }

        if (value instanceof Map<?, ?> map) {
            Map<String, Object> sorted = new TreeMap<>();
            map.forEach((key, entryValue) -> sorted.put(String.valueOf(key), entryValue));
            return writeJson(sorted, objectMapper);
        }

        if (value instanceof List<?> list) {
            List<Object> sortedElements = list.stream()
                    .map(entry -> entry instanceof Map<?, ?> entryMap
                            ? sortMap((Map<String, Object>) entryMap)
                            : entry)
                    .toList();
            return writeJson(sortedElements, objectMapper);
        }

        return String.valueOf(value);
    }

    private static Map<String, Object> sortMap(Map<String, Object> map) {
        return map.entrySet().stream()
                .sorted(Map.Entry.comparingByKey(Comparator.naturalOrder()))
                .collect(
                        LinkedHashMap::new,
                        (acc, entry) -> acc.put(entry.getKey(), entry.getValue()),
                        LinkedHashMap::putAll
                );
    }

    private static String writeJson(Object value, ObjectMapper objectMapper) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Cannot serialize payOS signature value", ex);
        }
    }

    private static String hmacSha256(String data, String key) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            byte[] bytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                result.append(String.format("%02x", b));
            }
            return result.toString();
        } catch (Exception ex) {
            throw new IllegalStateException("Cannot create payOS signature", ex);
        }
    }
}

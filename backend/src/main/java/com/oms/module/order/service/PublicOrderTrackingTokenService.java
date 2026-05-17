package com.oms.module.order.service;

import com.oms.module.order.entity.Order;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Optional;

@Service
public class PublicOrderTrackingTokenService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final Base64.Encoder TOKEN_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder TOKEN_DECODER = Base64.getUrlDecoder();

    @Value("${app.public.tracking-secret:}")
    private String trackingSecret;

    @Value("${app.jwt.secret:}")
    private String jwtSecret;

    public String createToken(Order order) {
        if (order == null || order.getId() == null || !StringUtils.hasText(order.getOrderCode())) {
            throw new IllegalArgumentException("Order must have id and orderCode before creating tracking token");
        }

        String payload = order.getId() + ":" + order.getOrderCode();
        String encodedPayload = encode(payload.getBytes(StandardCharsets.UTF_8));
        String encodedSignature = encode(sign(payload));
        return encodedPayload + "." + encodedSignature;
    }

    public Optional<TrackingTokenPayload> parseToken(String token) {
        if (!StringUtils.hasText(token)) {
            return Optional.empty();
        }

        String[] parts = token.trim().split("\\.", 2);
        if (parts.length != 2 || !StringUtils.hasText(parts[0]) || !StringUtils.hasText(parts[1])) {
            return Optional.empty();
        }

        try {
            String payload = new String(TOKEN_DECODER.decode(parts[0]), StandardCharsets.UTF_8);
            byte[] expectedSignature = sign(payload);
            byte[] actualSignature = TOKEN_DECODER.decode(parts[1]);

            if (!MessageDigest.isEqual(expectedSignature, actualSignature)) {
                return Optional.empty();
            }

            String[] payloadParts = payload.split(":", 2);
            if (payloadParts.length != 2 || !StringUtils.hasText(payloadParts[1])) {
                return Optional.empty();
            }

            return Optional.of(new TrackingTokenPayload(
                    Long.parseLong(payloadParts[0]),
                    payloadParts[1]
            ));
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }

    private String encode(byte[] bytes) {
        return TOKEN_ENCODER.encodeToString(bytes);
    }

    private byte[] sign(String payload) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(resolveSecret().getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (Exception ex) {
            throw new IllegalStateException("Cannot sign public order tracking token", ex);
        }
    }

    private String resolveSecret() {
        if (StringUtils.hasText(trackingSecret)) {
            return trackingSecret;
        }

        if (StringUtils.hasText(jwtSecret)) {
            return jwtSecret;
        }

        return "dev-only-public-order-tracking-secret";
    }

    public record TrackingTokenPayload(Long orderId, String orderCode) {
    }
}

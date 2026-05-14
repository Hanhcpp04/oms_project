package com.oms.security.jwt;

import com.oms.security.CustomUserDetails;
import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

/**
 * JWT token provider: generate, validate, and extract claims.
 * Access and refresh tokens are distinguished by a "type" claim.
 */
@Slf4j
@Component
public class JwtTokenProvider {

    private static final String CLAIM_TOKEN_TYPE = "type";
    private static final String TOKEN_TYPE_ACCESS = "access";
    private static final String TOKEN_TYPE_REFRESH = "refresh";

    private final JwtProperties jwtProperties;
    private volatile SecretKey cachedSigningKey;

    public JwtTokenProvider(JwtProperties jwtProperties) {
        this.jwtProperties = jwtProperties;
    }

    public long getRefreshTokenExpiration() {
        return jwtProperties.getRefreshTokenExpiration();
    }

    /**
     * Generate access token from UserDetails.
     */
    public String generateAccessToken(UserDetails userDetails) {
        return buildToken(Map.of(CLAIM_TOKEN_TYPE, TOKEN_TYPE_ACCESS),
                userDetails, jwtProperties.getAccessTokenExpiration());
    }

    /**
     * Generate refresh token from UserDetails.
     */
    public String generateRefreshToken(UserDetails userDetails) {
        Map<String, Object> claims = new HashMap<>();
        claims.put(CLAIM_TOKEN_TYPE, TOKEN_TYPE_REFRESH);
        claims.put("jti", UUID.randomUUID().toString());
        return buildToken(claims,
                userDetails, jwtProperties.getRefreshTokenExpiration());
    }

    /**
     * Extract username (subject) from token.
     */
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    /**
     * Validate token: check username matches, token is not expired,
     * and token is an ACCESS token (blocks refresh tokens from being used for API auth).
     */
    public boolean isTokenValid(String token, UserDetails userDetails) {
        try {
            final String username = extractUsername(token);
            return username.equals(userDetails.getUsername())
                    && !isTokenExpired(token)
                    && isAccessToken(token);
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Invalid JWT token: {}", e.getMessage());
            return false;
        }
    }

    // ==================== Private Methods ====================

    private boolean isAccessToken(String token) {
        try {
            String type = extractClaim(token, claims -> claims.get(CLAIM_TOKEN_TYPE, String.class));
            return TOKEN_TYPE_ACCESS.equals(type);
        } catch (JwtException e) {
            return false;
        }
    }

    private String buildToken(Map<String, Object> extraClaims, UserDetails userDetails, long expiration) {
        Map<String, Object> allClaims = new HashMap<>(extraClaims);
        if (userDetails instanceof CustomUserDetails cud) {
            if (cud.getShopId() != null) {
                allClaims.put("shopId", cud.getShopId());
            }
            allClaims.put("role", cud.getRole());
        }
        return Jwts.builder()
                .claims(allClaims)
                .subject(userDetails.getUsername())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSigningKey())
                .compact();
    }

    private <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private boolean isTokenExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    private SecretKey getSigningKey() {
        SecretKey key = cachedSigningKey;
        if (key == null) {
            synchronized (this) {
                key = cachedSigningKey;
                if (key == null) {
                    byte[] keyBytes = Decoders.BASE64.decode(jwtProperties.getSecret());
                    key = Keys.hmacShaKeyFor(keyBytes);
                    cachedSigningKey = key;
                }
            }
        }
        return key;
    }
}

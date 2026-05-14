package com.oms.module.auth.service;

import com.oms.module.auth.entity.RefreshToken;
import com.oms.module.auth.repository.RefreshTokenRepository;
import com.oms.module.user.entity.User;
import com.oms.security.CustomUserDetails;
import com.oms.security.jwt.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HexFormat;

/**
 * Handles JWT token issuance, refresh token persistence, and revocation.
 * Extracted from AuthService to separate token concerns from auth flow orchestration.
 */
@Service
@RequiredArgsConstructor
public class TokenService {

    private final JwtTokenProvider tokenProvider;
    private final RefreshTokenRepository refreshTokenRepository;

    /**
     * Represents an issued token pair (access + refresh).
     */
    public record TokenPair(String accessToken, String refreshToken) {}

    /**
     * Issue a new access + refresh token pair for the given user.
     * Persists the refresh token hash in the database.
     */
    @Transactional
    public TokenPair issueTokens(User user) {
        CustomUserDetails userDetails = toUserDetails(user);

        String accessToken = tokenProvider.generateAccessToken(userDetails);
        String refreshToken = tokenProvider.generateRefreshToken(userDetails);

        refreshTokenRepository.save(RefreshToken.builder()
                .user(user)
                .tokenHash(hashToken(refreshToken))
                .expiresAt(LocalDateTime.now().plus(Duration.ofMillis(tokenProvider.getRefreshTokenExpiration())))
                .build());

        return new TokenPair(accessToken, refreshToken);
    }

    /**
     * Revoke a refresh token by setting its revokedAt timestamp.
     */
    @Transactional
    public void revokeToken(RefreshToken refreshToken) {
        refreshToken.setRevokedAt(LocalDateTime.now());
        refreshTokenRepository.save(refreshToken);
    }

    /**
     * Hash a raw refresh token string using SHA-256.
     */
    public String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }

    private CustomUserDetails toUserDetails(User user) {
        return new CustomUserDetails(
                user.getId(),
                user.getShop() != null ? user.getShop().getId() : null,
                user.getEmail(),
                user.getPassword(),
                user.getRole().name(),
                Boolean.TRUE.equals(user.getIsActive())
        );
    }
}

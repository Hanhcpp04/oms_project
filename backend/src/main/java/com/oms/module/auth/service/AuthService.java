package com.oms.module.auth.service;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.common.util.SlugUtils;
import com.oms.module.auth.dto.AuthSessionResponse;
import com.oms.module.auth.dto.GoogleAuthRequest;
import com.oms.module.auth.dto.LoginRequest;
import com.oms.module.auth.dto.RefreshTokenRequest;
import com.oms.module.auth.dto.RegisterRequest;
import com.oms.module.auth.dto.UpdateProfileRequest;
import com.oms.module.auth.entity.OAuthAccount;
import com.oms.module.auth.entity.RefreshToken;
import com.oms.module.auth.repository.OAuthAccountRepository;
import com.oms.module.auth.repository.RefreshTokenRepository;
import com.oms.module.user.entity.User;
import com.oms.module.user.repository.UserRepository;
import com.oms.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Orchestrates authentication flows: login, register, Google auth, refresh, logout.
 * Delegates token operations to {@link TokenService} and session mapping to {@link SessionMapper}.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String GOOGLE_PROVIDER = "GOOGLE";

    private final AuthenticationManager authenticationManager;
    private final TokenService tokenService;
    private final SessionMapper sessionMapper;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final OAuthAccountRepository oAuthAccountRepository;
    private final PasswordEncoder passwordEncoder;
    private final GoogleTokenVerifier googleTokenVerifier;

    // ==================== Login / Register ====================

    @Transactional
    public AuthSessionResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getIdentifier(), request.getPassword()));

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        User user = userRepository.findById(userDetails.getUserId())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        return issueSession(user);
    }

    @Transactional
    public AuthSessionResponse register(RegisterRequest request) {
        String email = request.getEmail().trim();
        String fullName = request.getFullName().trim();

        if (userRepository.existsByEmail(email)) {
            throw new BusinessException(ErrorCode.USER_EMAIL_EXISTS);
        }

        User user = createOwnerUser(email, fullName, request.getPassword());
        return issueSession(user);
    }

    // ==================== Google Auth (unified login + register) ====================

    @Transactional
    public AuthSessionResponse authenticateWithGoogle(GoogleAuthRequest request) {
        GoogleTokenVerifier.GoogleUserProfile profile = googleTokenVerifier.verify(request.getIdToken());

        OAuthAccount account = oAuthAccountRepository
                .findByProviderAndProviderUserId(GOOGLE_PROVIDER, profile.providerUserId())
                .orElseGet(() -> linkGoogleAccount(profile));

        User user = account.getUser();
        user.setLastLogin(LocalDateTime.now());
        account.setProviderEmail(profile.email());
        account.setProviderAvatarUrl(profile.avatarUrl());
        account.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);
        oAuthAccountRepository.save(account);

        return issueSession(user);
    }

    // ==================== Token Management ====================

    @Transactional
    public AuthSessionResponse refresh(RefreshTokenRequest request) {
        String tokenHash = tokenService.hashToken(request.getRefreshToken());

        List<RefreshToken> matchingTokens = refreshTokenRepository.findAllByTokenHash(tokenHash);
        RefreshToken storedToken = matchingTokens.stream()
            .filter(token -> !token.isRevoked() && !token.isExpired())
            .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_TOKEN_INVALID, "Refresh token is invalid"));

        if (storedToken.isRevoked() || storedToken.isExpired()) {
            throw new BusinessException(ErrorCode.AUTH_TOKEN_EXPIRED, "Refresh token has expired");
        }

        User user = storedToken.getUser();
        matchingTokens.forEach(tokenService::revokeToken);

        return issueSession(user);
    }

    @Transactional
    public void logout(RefreshTokenRequest request) {
        refreshTokenRepository.findAllByTokenHash(tokenService.hashToken(request.getRefreshToken()))
            .forEach(tokenService::revokeToken);
    }

    // ==================== Session / Profile ====================

    @Transactional(readOnly = true)
    public AuthSessionResponse getCurrentSession(Long userId) {
        User user = findUserById(userId);
        return sessionMapper.toSessionResponse(user);
    }

    @Transactional
    public void changePassword(Long userId, String currentPassword, String newPassword) {
        User user = findUserById(userId);

        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Current password does not match");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setForceChangePassword(false);
        user.setTemporaryPassword(null);
        userRepository.save(user);
    }

    @Transactional
    public AuthSessionResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = findUserById(userId);

        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            user.setFullName(request.getFullName().trim());
        }

        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            userRepository.findByEmail(request.getEmail().trim())
                    .ifPresent(existing -> {
                        if (!existing.getId().equals(user.getId())) {
                            throw new BusinessException(ErrorCode.USER_EMAIL_EXISTS);
                        }
                    });
            user.setEmail(request.getEmail().trim());
        }

        if (request.getPhone() != null) {
            user.setPhone(request.getPhone().trim());
        }

        User savedUser = userRepository.save(user);
        return issueSession(savedUser);
    }

    // ==================== Public API for ShopService ====================

    /**
     * Issue a new session with fresh tokens for the given user.
     * Called by ShopService after shop data changes that affect the session.
     */
    public AuthSessionResponse issueSession(User user) {
        TokenService.TokenPair tokens = tokenService.issueTokens(user);
        return sessionMapper.toSessionResponse(user, tokens);
    }

    // ==================== Private Helpers ====================

    private User findUserById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }

    private OAuthAccount linkGoogleAccount(GoogleTokenVerifier.GoogleUserProfile profile) {
        User user = userRepository.findByEmail(profile.email())
                .orElseGet(() -> createGoogleOwnerUser(profile));

        oAuthAccountRepository.findByProviderAndUser_Id(GOOGLE_PROVIDER, user.getId())
                .ifPresent(existing -> {
                    throw new BusinessException(ErrorCode.AUTH_GOOGLE_TOKEN_INVALID,
                            "This OMS account is already linked to another Google account");
                });

        OAuthAccount account = OAuthAccount.builder()
                .user(user)
                .provider(GOOGLE_PROVIDER)
                .providerUserId(profile.providerUserId())
                .providerEmail(profile.email())
                .providerAvatarUrl(profile.avatarUrl())
                .linkedAt(LocalDateTime.now())
                .lastLoginAt(LocalDateTime.now())
                .build();

        return oAuthAccountRepository.save(account);
    }

    private User createGoogleOwnerUser(GoogleTokenVerifier.GoogleUserProfile profile) {
        String fullName = (profile.fullName() != null && !profile.fullName().isBlank())
                ? profile.fullName().trim()
                : profile.email();
        return createOwnerUser(profile.email(), fullName, "GoogleAuth@" + System.currentTimeMillis());
    }

    private User createOwnerUser(String email, String fullName, String password) {
        User user = User.builder()
                .email(email)
                .username(generateUniqueUsername(email, fullName))
                .password(passwordEncoder.encode(password))
                .fullName(fullName)
                .role(User.UserRole.OWNER)
                .build();

        return userRepository.save(user);
    }

    private String generateUniqueUsername(String email, String fullName) {
        String base = SlugUtils.toSlug(fullName);

        if (base.isBlank()) {
            base = email.split("@")[0].toLowerCase();
        }

        String candidate = base;
        int suffix = 1;
        while (userRepository.existsByUsername(candidate)) {
            candidate = base + suffix++;
        }

        return candidate;
    }
}

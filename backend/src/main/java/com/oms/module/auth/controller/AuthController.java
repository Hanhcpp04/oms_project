package com.oms.module.auth.controller;

import com.oms.common.dto.ApiResponse;
import com.oms.module.auth.dto.AuthSessionResponse;
import com.oms.module.auth.dto.ChangePasswordRequest;
import com.oms.module.auth.dto.GoogleAuthRequest;
import com.oms.module.auth.dto.LoginRequest;
import com.oms.module.auth.dto.RefreshTokenRequest;
import com.oms.module.auth.dto.RegisterRequest;
import com.oms.module.auth.dto.UpdateProfileRequest;
import com.oms.module.auth.service.AuthService;
import com.oms.security.CustomUserDetails;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Login, Register, Token management")
public class AuthController {

    private final AuthService authService;

    // ==================== Public Endpoints ====================

    @PostMapping("/login")
    @Operation(summary = "Login with username/email and password")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> login(@Valid @RequestBody LoginRequest request) {
        AuthSessionResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.ok("Login successful", response));
    }

    @PostMapping("/register")
    @Operation(summary = "Register new shop owner")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> register(@Valid @RequestBody RegisterRequest request) {
        AuthSessionResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(response));
    }

    @PostMapping("/google")
    @Operation(summary = "Authenticate with Google (auto-login or auto-register)")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> authenticateWithGoogle(
            @Valid @RequestBody GoogleAuthRequest request) {
        AuthSessionResponse response = authService.authenticateWithGoogle(request);
        return ResponseEntity.ok(ApiResponse.ok("Google auth successful", response));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh access token")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Token refreshed", authService.refresh(request)));
    }

    @PostMapping("/logout")
    @Operation(summary = "Logout current session")
    public ResponseEntity<ApiResponse<Void>> logout(@Valid @RequestBody RefreshTokenRequest request) {
        authService.logout(request);
        return ResponseEntity.ok(ApiResponse.ok("Logged out successfully", null));
    }

    // ==================== Authenticated Endpoints ====================

    @GetMapping("/me")
    @Operation(summary = "Get current authenticated session")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> me(@AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(authService.getCurrentSession(user.getUserId())));
    }

    @PostMapping("/change-password")
    @Operation(summary = "Change password for the current user")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        authService.changePassword(userDetails.getUserId(), request.getCurrentPassword(), request.getNewPassword());
        return ResponseEntity.ok(ApiResponse.ok("Password changed successfully", null));
    }

    @PostMapping("/update-profile")
    @Operation(summary = "Update current user profile info")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> updateProfile(
            @Valid @RequestBody UpdateProfileRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        AuthSessionResponse response = authService.updateProfile(userDetails.getUserId(), request);
        return ResponseEntity.ok(ApiResponse.ok("Profile updated successfully", response));
    }
}

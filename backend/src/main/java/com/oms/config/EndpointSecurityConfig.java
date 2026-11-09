package com.oms.config;

/**
 * CENTRALIZED endpoint access rules.
 * Open this single file to audit all route security in the system.
 *
 * Fine-grained OWNER vs STAFF permissions are handled by @RequirePermission at method level.
 */
public final class EndpointSecurityConfig {

    // ===== PUBLIC — No token required =====
    public static final String[] PUBLIC_GET_ENDPOINTS = {
            "/swagger-ui/**",
            "/v3/api-docs/**",
            "/actuator/health/**",
            "/api/public/**",
            "/api/files/display/**",
            "/public/**",
            "/webhook"
    };

    public static final String[] PUBLIC_POST_ENDPOINTS = {
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/google",
            "/api/auth/refresh",
            "/api/auth/logout",
            "/api/public/**",
            "/api/payments/payos/webhook",
            "/api/orders/public",
            "/public/**",
            "/webhook"
    };

    // ===== ADMIN ONLY — Platform administrators =====
    public static final String[] ADMIN_ENDPOINTS = {
            "/api/admin/**"
    };

    // Everything else → authenticated (OWNER, STAFF, or ADMIN)
    // OWNER vs STAFF distinction handled by @RequirePermission annotation

    private EndpointSecurityConfig() {}
}

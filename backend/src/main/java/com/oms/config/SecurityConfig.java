package com.oms.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.common.dto.ErrorResponse;
import com.oms.common.exception.ErrorCode;
import com.oms.security.jwt.JwtAuthFilter;
import com.oms.security.AuditLogFilter;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.AuthorizeHttpRequestsConfigurer;
import org.springframework.security.config.annotation.web.configurers.ExceptionHandlingConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final AuditLogFilter auditLogFilter;
    private final UserDetailsService userDetailsService;
    private final ObjectMapper objectMapper;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .cors(cors -> {})
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(this::configurePublicEndpoints)
                .exceptionHandling(this::configureExceptionHandlers)
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(auditLogFilter, JwtAuthFilter.class)
                .build();
    }

    // ==================== Authorization Rules ====================
    // All route rules are defined in EndpointSecurityConfig for centralized auditing.
    // Fine-grained OWNER vs STAFF checks use @RequirePermission at method level.

    private void configurePublicEndpoints(
            AuthorizeHttpRequestsConfigurer<HttpSecurity>.AuthorizationManagerRequestMatcherRegistry auth) {
        auth
                // Public GET endpoints (no token needed)
                .requestMatchers(EndpointSecurityConfig.PUBLIC_GET_ENDPOINTS).permitAll()
                // Public POST endpoints (no token needed)
                .requestMatchers(HttpMethod.POST, EndpointSecurityConfig.PUBLIC_POST_ENDPOINTS).permitAll()
                // Admin-only endpoints
                .requestMatchers(EndpointSecurityConfig.ADMIN_ENDPOINTS).hasRole("ADMIN")
                // Everything else requires authentication
                .anyRequest().authenticated();
    }

    // ==================== Exception Handling ====================

    private void configureExceptionHandlers(ExceptionHandlingConfigurer<HttpSecurity> ex) {
        ex
                .authenticationEntryPoint(jsonAuthEntryPoint())
                .accessDeniedHandler(jsonAccessDeniedHandler());
    }

    private AuthenticationEntryPoint jsonAuthEntryPoint() {
        return (request, response, authException) ->
                writeJsonError(response, HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED, request.getRequestURI());
    }

    private AccessDeniedHandler jsonAccessDeniedHandler() {
        return (request, response, accessDeniedException) ->
                writeJsonError(response, HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, request.getRequestURI());
    }

    private void writeJsonError(HttpServletResponse response, HttpStatus status,
                                ErrorCode code, String path) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());

        ErrorResponse error = ErrorResponse.builder()
                .status(status.value())
                .error(code.getCode())
                .message(code.getMessage())
                .path(path)
                .build();

        objectMapper.writeValue(response.getOutputStream(), error);
    }

    // ==================== Beans ====================

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public FilterRegistrationBean<JwtAuthFilter> disableJwtFilterAutoRegistration() {
        FilterRegistrationBean<JwtAuthFilter> registration = new FilterRegistrationBean<>(jwtAuthFilter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public FilterRegistrationBean<AuditLogFilter> disableAuditFilterAutoRegistration() {
        FilterRegistrationBean<AuditLogFilter> registration = new FilterRegistrationBean<>(auditLogFilter);
        registration.setEnabled(false);
        return registration;
    }
}

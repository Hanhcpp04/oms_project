package com.oms.security;

import com.oms.config.RequestCorrelationFilter;
import com.oms.module.admin.entity.AuditEvent;
import com.oms.module.admin.repository.AuditEventRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Set;

@Component
@RequiredArgsConstructor
@Slf4j
public class AuditLogFilter extends OncePerRequestFilter {

    private static final Set<String> MUTATING_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");
    private final AuditEventRepository auditEventRepository;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        try {
            filterChain.doFilter(request, response);
        } finally {
            recordAuthenticatedMutation(request, response);
        }
    }

    private void recordAuthenticatedMutation(HttpServletRequest request, HttpServletResponse response) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!MUTATING_METHODS.contains(request.getMethod())
                || !request.getRequestURI().startsWith("/api/")
                || authentication == null
                || !(authentication.getPrincipal() instanceof CustomUserDetails user)) {
            return;
        }

        try {
            AuditEvent event = new AuditEvent();
            event.setActorUserId(user.getUserId());
            event.setActorEmail(user.getEmail());
            event.setHttpMethod(request.getMethod());
            event.setRequestPath(request.getRequestURI());
            event.setResponseStatus(response.getStatus());
            event.setRequestId(response.getHeader(RequestCorrelationFilter.REQUEST_ID_HEADER));
            event.setRemoteAddress(request.getRemoteAddr());
            event.setOccurredAt(LocalDateTime.now());
            auditEventRepository.save(event);
        } catch (RuntimeException ex) {
            log.warn("Could not persist audit event for {} {}", request.getMethod(), request.getRequestURI(), ex);
        }
    }
}

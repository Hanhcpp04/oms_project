package com.oms.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class RateLimitFilter extends OncePerRequestFilter {

    private final ConcurrentHashMap<String, WindowCounter> counters = new ConcurrentHashMap<>();
    private final Clock clock = Clock.systemUTC();

    @Value("${app.security.rate-limit.enabled:true}")
    private boolean enabled;

    @Value("${app.security.rate-limit.window-seconds:60}")
    private long windowSeconds;

    @Value("${app.security.rate-limit.auth-max-requests:20}")
    private int authMaxRequests;

    @Value("${app.security.rate-limit.public-max-requests:120}")
    private int publicMaxRequests;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        LimitGroup group = enabled ? resolveGroup(request) : null;
        if (group == null) {
            filterChain.doFilter(request, response);
            return;
        }

        long window = Math.max(1, windowSeconds);
        long windowId = clock.instant().getEpochSecond() / window;
        String key = request.getRemoteAddr() + ':' + group.name();
        WindowCounter counter = counters.compute(key, (ignored, current) ->
                current == null || current.windowId != windowId
                        ? new WindowCounter(windowId)
                        : current);
        int count = counter.requests.incrementAndGet();

        response.setHeader("X-RateLimit-Limit", String.valueOf(group.maxRequests));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(Math.max(0, group.maxRequests - count)));
        if (count <= group.maxRequests) {
            filterChain.doFilter(request, response);
            return;
        }

        response.setStatus(429);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader("Retry-After", String.valueOf(window));
        response.getWriter().write("{\"error\":\"RATE_LIMITED\",\"message\":\"Too many requests\"}");
    }

    private LimitGroup resolveGroup(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return null;
        }
        String path = request.getRequestURI();
        if (path.startsWith("/api/auth/login")
                || path.startsWith("/api/auth/register")
                || path.startsWith("/api/auth/google")
                || path.startsWith("/api/auth/refresh")) {
            return new LimitGroup("AUTH", Math.max(1, authMaxRequests));
        }
        if (path.startsWith("/api/public/")
                || path.startsWith("/api/orders/public")
                || path.startsWith("/public/")
                || path.equals("/webhook")) {
            return new LimitGroup("PUBLIC", Math.max(1, publicMaxRequests));
        }
        return null;
    }

    private static final class WindowCounter {
        private final long windowId;
        private final AtomicInteger requests = new AtomicInteger();

        private WindowCounter(long windowId) {
            this.windowId = windowId;
        }
    }

    private record LimitGroup(String name, int maxRequests) {
    }
}

package com.oms.security;

import com.oms.module.admin.entity.AuditEvent;
import com.oms.module.admin.repository.AuditEventRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class AuditLogFilterTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldPersistAuthenticatedMutation() throws Exception {
        AuditEventRepository repository = mock(AuditEventRepository.class);
        AuditLogFilter filter = new AuditLogFilter(repository);
        CustomUserDetails user = new CustomUserDetails(7L, 3L, "owner@example.com", "", "OWNER", true);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
        MockHttpServletRequest request = new MockHttpServletRequest("PATCH", "/api/shops/3");
        request.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(204);

        filter.doFilter(request, response, new MockFilterChain());

        ArgumentCaptor<AuditEvent> event = ArgumentCaptor.forClass(AuditEvent.class);
        verify(repository).save(event.capture());
        assertThat(event.getValue().getActorUserId()).isEqualTo(7L);
        assertThat(event.getValue().getRequestPath()).isEqualTo("/api/shops/3");
        assertThat(event.getValue().getResponseStatus()).isEqualTo(204);
    }
}

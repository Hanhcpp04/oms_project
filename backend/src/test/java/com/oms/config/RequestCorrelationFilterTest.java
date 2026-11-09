package com.oms.config;

import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class RequestCorrelationFilterTest {

    private final RequestCorrelationFilter filter = new RequestCorrelationFilter();

    @Test
    void shouldReuseSafeRequestId() throws Exception {
        var request = new MockHttpServletRequest();
        request.addHeader(RequestCorrelationFilter.REQUEST_ID_HEADER, "request-123");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getHeader(RequestCorrelationFilter.REQUEST_ID_HEADER)).isEqualTo("request-123");
        assertThat(MDC.get("requestId")).isNull();
    }

    @Test
    void shouldReplaceUnsafeRequestId() throws Exception {
        var request = new MockHttpServletRequest();
        request.addHeader(RequestCorrelationFilter.REQUEST_ID_HEADER, "invalid request id\n");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getHeader(RequestCorrelationFilter.REQUEST_ID_HEADER))
                .isNotBlank()
                .doesNotContain("invalid request id");
        assertThat(MDC.get("requestId")).isNull();
    }
}

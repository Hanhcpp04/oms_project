package com.oms.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
@Getter
@Setter
@ConfigurationProperties(prefix = "app.payment.payos")
public class PayosProperties {

    private boolean enabled = false;
    private String baseUrl = "https://api-merchant.payos.vn";
    private String clientId;
    private String apiKey;
    private String checksumKey;
    private String returnUrl;
    private String cancelUrl;

    public boolean isConfigured() {
        return enabled
                && StringUtils.hasText(clientId)
                && StringUtils.hasText(apiKey)
                && StringUtils.hasText(checksumKey)
                && StringUtils.hasText(returnUrl)
                && StringUtils.hasText(cancelUrl);
    }
}

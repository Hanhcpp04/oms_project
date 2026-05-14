package com.oms.security.jwt;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * JWT configuration properties.
 * Configured via application.yml under 'app.jwt.*'
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.jwt")
public class JwtProperties {

    private String secret = "defaultSecretKeyThatShouldBeChangedInProduction12345678";
    private long accessTokenExpiration = 86400000;   // 24 hours
    private long refreshTokenExpiration = 604800000; // 7 days
}

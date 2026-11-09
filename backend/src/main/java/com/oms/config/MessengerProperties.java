package com.oms.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
@Getter
@Setter
@ConfigurationProperties(prefix = "app.messenger")
public class MessengerProperties {

    private String verifyToken;
    private String appSecret;
    private String graphApiBaseUrl = "https://graph.facebook.com/v20.0";
    private String systemPrefix = "[OMS]";
    private String defaultPageId;
    private Long defaultShopId;
    private String defaultPageAccessToken;
    private int draftTtlHours = 24;
    private Map<String, String> pageAccessTokens = new HashMap<>();
}

package com.oms.module.auth.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
@RequiredArgsConstructor
public class GoogleTokenVerifier {

    private final RestClient restClient = RestClient.builder()
            .baseUrl("https://oauth2.googleapis.com")
            .build();

    @Value("${app.google.client-id:}")
    private String googleClientId;

    public GoogleUserProfile verify(String idToken) {
        if (googleClientId == null || googleClientId.isBlank()) {
            throw new BusinessException(ErrorCode.AUTH_GOOGLE_NOT_CONFIGURED, "Google login is not configured");
        }

        try {
            GoogleTokenInfo response = restClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/tokeninfo")
                            .queryParam("id_token", idToken)
                            .build())
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (_request, _response) -> {
                        throw new BusinessException(ErrorCode.AUTH_GOOGLE_TOKEN_INVALID, "Invalid Google ID token");
                    })
                    .body(GoogleTokenInfo.class);

            if (response == null || response.sub == null || response.email == null) {
                throw new BusinessException(ErrorCode.AUTH_GOOGLE_TOKEN_INVALID, "Google account data is missing");
            }

            if (!googleClientId.equals(response.aud)) {
                throw new BusinessException(ErrorCode.AUTH_GOOGLE_TOKEN_INVALID, "Google client ID does not match");
            }

            if (!Boolean.parseBoolean(response.emailVerified)) {
                throw new BusinessException(ErrorCode.AUTH_GOOGLE_TOKEN_INVALID, "Google email is not verified");
            }

            return new GoogleUserProfile(response.sub, response.email, response.name, response.picture);
        } catch (RestClientResponseException ex) {
            throw new BusinessException(ErrorCode.AUTH_GOOGLE_TOKEN_INVALID, "Invalid Google ID token");
        }
    }

    public record GoogleUserProfile(String providerUserId, String email, String fullName, String avatarUrl) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class GoogleTokenInfo {
        public String aud;
        public String sub;
        public String email;
        public String name;
        public String picture;
        @JsonProperty("email_verified")
        public String emailVerified;
    }
}

package com.oms.module.messenger.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.oms.config.MessengerProperties;
import com.oms.module.messenger.dto.MessengerSendResult;
import com.oms.module.messenger.entity.OutboundSystemMessage;
import com.oms.module.messenger.repository.OutboundSystemMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessengerSendService {

    private final MessengerProperties messengerProperties;
    private final MessengerPageResolver messengerPageResolver;
    private final OutboundSystemMessageRepository outboundSystemMessageRepository;

    public boolean sendMessage(String pageId, String recipientId, String text) {
        return sendSystemMessage(pageId, recipientId, text).isSent();
    }

    @Transactional
    public MessengerSendResult sendImage(String pageId, String recipientId, String imageUrl) {
        if (!StringUtils.hasText(imageUrl)) {
            return MessengerSendResult.notSent();
        }

        MessengerSendResult result = sendRawImage(pageId, recipientId, imageUrl);
        if (result.isSent() && StringUtils.hasText(result.getMessageId())) {
            outboundSystemMessageRepository.save(OutboundSystemMessage.builder()
                    .messageId(result.getMessageId())
                    .pageId(pageId)
                    .recipientId(recipientId)
                    .text("[image] " + imageUrl)
                    .build());
        }

        return result;
    }

    @Transactional
    public MessengerSendResult sendSystemMessage(String pageId, String recipientId, String text) {
        if (!StringUtils.hasText(text)) {
            return MessengerSendResult.notSent();
        }

        String normalizedText = ensureSystemPrefix(text);
        MessengerSendResult result = sendRawMessage(pageId, recipientId, normalizedText);
        if (result.isSent() && StringUtils.hasText(result.getMessageId())) {
            outboundSystemMessageRepository.save(OutboundSystemMessage.builder()
                    .messageId(result.getMessageId())
                    .pageId(pageId)
                    .recipientId(recipientId)
                    .text(normalizedText)
                    .build());
        }

        return result;
    }

    public boolean isSystemMessageId(String messageId) {
        return StringUtils.hasText(messageId) && outboundSystemMessageRepository.existsByMessageId(messageId);
    }

    public boolean hasSystemPrefix(String text) {
        return StringUtils.hasText(text) && text.trim().startsWith(messengerProperties.getSystemPrefix());
    }

    private MessengerSendResult sendRawMessage(String pageId, String recipientId, String text) {
        if (!StringUtils.hasText(pageId) || !StringUtils.hasText(recipientId)) {
            return MessengerSendResult.notSent();
        }

        return messengerPageResolver.resolvePageAccessToken(pageId)
                .map(token -> callSendApi(pageId, recipientId, text, token))
                .orElseGet(() -> {
                    log.info("Messenger send service is not configured. pageId={}, recipientId={}, message={}",
                            pageId, recipientId, text);
                    return MessengerSendResult.notSent();
                });
    }

    private MessengerSendResult sendRawImage(String pageId, String recipientId, String imageUrl) {
        if (!StringUtils.hasText(pageId) || !StringUtils.hasText(recipientId)) {
            return MessengerSendResult.notSent();
        }

        return messengerPageResolver.resolvePageAccessToken(pageId)
                .map(token -> callSendImageApi(pageId, recipientId, imageUrl, token))
                .orElseGet(() -> {
                    log.info("Messenger send image service is not configured. pageId={}, recipientId={}, imageUrl={}",
                            pageId, recipientId, imageUrl);
                    return MessengerSendResult.notSent();
                });
    }

    private MessengerSendResult callSendApi(String pageId, String recipientId, String text, String pageAccessToken) {
        try {
            RestClient client = RestClient.builder()
                    .baseUrl(messengerProperties.getGraphApiBaseUrl())
                    .build();

            JsonNode response = client.post()
                    .uri(uriBuilder -> uriBuilder
                            .path("/{pageId}/messages")
                            .queryParam("access_token", pageAccessToken)
                            .build(pageId))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "recipient", Map.of("id", recipientId),
                            "messaging_type", "RESPONSE",
                            "message", Map.of("text", text)
                    ))
                    .retrieve()
                    .body(JsonNode.class);

            String messageId = response == null ? null : response.path("message_id").asText(null);
            log.info("Sent Messenger system message. pageId={}, recipientId={}, messageId={}",
                    pageId, recipientId, messageId);
            return MessengerSendResult.builder()
                    .sent(true)
                    .messageId(messageId)
                    .build();
        } catch (RestClientException ex) {
            log.warn("Failed to send Messenger system message. pageId={}, recipientId={}, reason={}",
                    pageId, recipientId, ex.getMessage());
            return MessengerSendResult.notSent();
        }
    }

    private MessengerSendResult callSendImageApi(String pageId, String recipientId, String imageUrl, String pageAccessToken) {
        try {
            RestClient client = RestClient.builder()
                    .baseUrl(messengerProperties.getGraphApiBaseUrl())
                    .build();

            JsonNode response = client.post()
                    .uri(uriBuilder -> uriBuilder
                            .path("/{pageId}/messages")
                            .queryParam("access_token", pageAccessToken)
                            .build(pageId))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "recipient", Map.of("id", recipientId),
                            "messaging_type", "RESPONSE",
                            "message", Map.of(
                                    "attachment", Map.of(
                                            "type", "image",
                                            "payload", Map.of(
                                                    "url", imageUrl,
                                                    "is_reusable", true
                                            )
                                    )
                            )
                    ))
                    .retrieve()
                    .body(JsonNode.class);

            String messageId = response == null ? null : response.path("message_id").asText(null);
            log.info("Sent Messenger system image. pageId={}, recipientId={}, messageId={}",
                    pageId, recipientId, messageId);
            return MessengerSendResult.builder()
                    .sent(true)
                    .messageId(messageId)
                    .build();
        } catch (RestClientException ex) {
            log.warn("Failed to send Messenger system image. pageId={}, recipientId={}, reason={}",
                    pageId, recipientId, ex.getMessage());
            return MessengerSendResult.notSent();
        }
    }

    private String ensureSystemPrefix(String text) {
        String trimmed = text.trim();
        String prefix = messengerProperties.getSystemPrefix();
        if (trimmed.startsWith(prefix)) {
            return trimmed;
        }
        return prefix + "\n" + trimmed;
    }
}

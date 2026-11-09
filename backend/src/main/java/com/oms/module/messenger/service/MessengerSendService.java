package com.oms.module.messenger.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.config.MessengerProperties;
import com.oms.module.messenger.dto.MessengerSendResult;
import com.oms.module.messenger.entity.OutboundSystemMessage;
import com.oms.module.messenger.entity.OutboundQueueItem;
import com.oms.module.messenger.repository.OutboundQueueItemRepository;
import com.oms.module.messenger.repository.OutboundSystemMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.data.domain.PageRequest;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Map;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessengerSendService {

    private final MessengerProperties messengerProperties;
    private final MessengerPageResolver messengerPageResolver;
    private final OutboundSystemMessageRepository outboundSystemMessageRepository;
    private final OutboundQueueItemRepository outboundQueueItemRepository;
    private final ObjectMapper objectMapper;

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
        } else if (!result.isSent()) {
            queueFailedMessage(pageId, recipientId, OutboundQueueItem.PayloadType.IMAGE, imageUrl);
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
        } else if (!result.isSent()) {
            queueFailedMessage(pageId, recipientId, OutboundQueueItem.PayloadType.TEXT, normalizedText);
        }

        return result;
    }

    public boolean isSystemMessageId(String messageId) {
        return StringUtils.hasText(messageId) && outboundSystemMessageRepository.existsByMessageId(messageId);
    }

    public boolean hasSystemPrefix(String text) {
        return StringUtils.hasText(text) && text.trim().startsWith(messengerProperties.getSystemPrefix());
    }

    @Scheduled(fixedDelayString = "${app.messenger.outbound-retry-interval-ms:30000}")
    @Transactional
    public void retryQueuedMessages() {
        var dueItems = outboundQueueItemRepository
                .findByStatusAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(
                        OutboundQueueItem.QueueStatus.PENDING,
                        LocalDateTime.now(),
                        PageRequest.of(0, 50));
        for (OutboundQueueItem item : dueItems) {
            MessengerSendResult result = messengerPageResolver.resolvePageAccessToken(item.getPageId())
                    .map(token -> item.getPayloadType() == OutboundQueueItem.PayloadType.IMAGE
                            ? callSendImageApi(item.getPageId(), item.getRecipientId(), item.getPayload(), token)
                            : callSendApi(item.getPageId(), item.getRecipientId(), item.getPayload(), token))
                    .orElseGet(MessengerSendResult::notSent);
            if (result.isSent()) {
                if (StringUtils.hasText(result.getMessageId())) {
                    outboundSystemMessageRepository.save(OutboundSystemMessage.builder()
                            .messageId(result.getMessageId())
                            .pageId(item.getPageId())
                            .recipientId(item.getRecipientId())
                            .text(item.getPayload())
                            .build());
                }
                outboundQueueItemRepository.delete(item);
                continue;
            }

            int attempts = item.getAttempts() + 1;
            item.setAttempts(attempts);
            item.setLastError("Messenger API send failed");
            if (attempts >= 5) {
                item.setStatus(OutboundQueueItem.QueueStatus.DEAD);
            } else {
                item.setNextAttemptAt(LocalDateTime.now().plusSeconds(30L * attempts));
            }
            outboundQueueItemRepository.save(item);
        }
    }

    private void queueFailedMessage(String pageId, String recipientId,
                                    OutboundQueueItem.PayloadType payloadType, String payload) {
        if (!StringUtils.hasText(pageId) || !StringUtils.hasText(recipientId) || !StringUtils.hasText(payload)) {
            return;
        }
        outboundQueueItemRepository.save(OutboundQueueItem.builder()
                .pageId(pageId)
                .recipientId(recipientId)
                .payloadType(payloadType)
                .payload(payload)
                .nextAttemptAt(LocalDateTime.now().plusSeconds(30))
                .lastError("Messenger API send failed")
                .build());
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
        MessengerSendResult result = MessengerSendResult.notSent();
        for (int attempt = 1; attempt <= 3; attempt++) {
            result = callSendApiOnce(pageId, recipientId, text, pageAccessToken);
            if (result.isSent()) {
                return result;
            }
            pauseBeforeRetry(attempt);
        }
        return result;
    }

    private MessengerSendResult callSendApiOnce(String pageId, String recipientId, String text, String pageAccessToken) {
        try {
            RestClient client = RestClient.builder()
                    .baseUrl(messengerProperties.getGraphApiBaseUrl())
                    .build();

            String responseStr = client.post()
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
                    .body(String.class);

            JsonNode response = null;
            if (responseStr != null) {
                try {
                    response = objectMapper.readTree(responseStr);
                } catch (JsonProcessingException e) {
                    log.warn("Failed to parse response: {}", responseStr, e);
                }
            }

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
        MessengerSendResult result = MessengerSendResult.notSent();
        for (int attempt = 1; attempt <= 3; attempt++) {
            result = callSendImageApiOnce(pageId, recipientId, imageUrl, pageAccessToken);
            if (result.isSent()) {
                return result;
            }
            pauseBeforeRetry(attempt);
        }
        return result;
    }

    private MessengerSendResult callSendImageApiOnce(String pageId, String recipientId, String imageUrl, String pageAccessToken) {
        try {
            RestClient client = RestClient.builder()
                    .baseUrl(messengerProperties.getGraphApiBaseUrl())
                    .build();

            String responseStr = client.post()
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
                    .body(String.class);

            JsonNode response = null;
            if (responseStr != null) {
                try {
                    response = objectMapper.readTree(responseStr);
                } catch (JsonProcessingException e) {
                    log.warn("Failed to parse response: {}", responseStr, e);
                }
            }

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

    private void pauseBeforeRetry(int attempt) {
        if (attempt >= 3) {
            return;
        }
        try {
            Thread.sleep(200L * attempt);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
    }
}

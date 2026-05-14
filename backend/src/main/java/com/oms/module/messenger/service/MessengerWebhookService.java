package com.oms.module.messenger.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.module.messenger.entity.Conversation;
import com.oms.module.messenger.entity.MessengerOrder;
import com.oms.module.messenger.enums.MessageSenderType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessengerWebhookService {

    private static final String CUSTOMER_CONFIRM_REPLY =
            "Cảm ơn bạn, đơn hàng của bạn đã được xác nhận. Shop sẽ xử lý đơn sớm ạ.";
    private static final String INTERNAL_CREATE_DRAFT_COMMAND = "tao don msg";

    private final ObjectMapper objectMapper;
    private final ConversationService conversationService;
    private final MessageService messageService;
    private final OrderDraftService orderDraftService;
    private final MessengerOrderService messengerOrderService;
    private final MessengerSendService messengerSendService;

    @Transactional
    public void handleWebhook(String body) {
        try {
            JsonNode root = objectMapper.readTree(body);
            JsonNode entries = root.path("entry");
            if (!entries.isArray()) {
                log.warn("Messenger webhook payload has no entry array");
                return;
            }

            for (JsonNode entry : entries) {
                JsonNode messagingEvents = entry.path("messaging");
                if (!messagingEvents.isArray()) {
                    continue;
                }

                for (JsonNode messagingEvent : messagingEvents) {
                    processMessagingEvent(messagingEvent, body);
                }
            }
        } catch (Exception ex) {
            log.error("Failed to process Messenger webhook payload", ex);
        }
    }

    protected void processMessagingEvent(JsonNode event, String rawPayload) {
        JsonNode messageNode = event.path("message");
        if (messageNode.isMissingNode() || messageNode.isNull()) {
            return;
        }

        boolean echo = messageNode.path("is_echo").asBoolean(false);
        String pageId = echo
                ? textValue(event.path("sender").path("id"))
                : textValue(event.path("recipient").path("id"));
        String conversationSenderId = echo
                ? textValue(event.path("recipient").path("id"))
                : textValue(event.path("sender").path("id"));
        String actualSenderId = echo
                ? textValue(event.path("sender").path("id"))
                : textValue(event.path("sender").path("id"));

        if (!StringUtils.hasText(pageId) || !StringUtils.hasText(conversationSenderId)) {
            log.warn("Messenger message ignored because pageId or senderId is missing. event={}", event);
            return;
        }

        String text = textValue(messageNode.path("text"));
        LocalDateTime messageTime = parseMessageTime(event.path("timestamp").asLong(0));
        Conversation conversation = conversationService.getOrCreateFacebookConversation(pageId, conversationSenderId);
        MessageSenderType senderType = echo ? MessageSenderType.STAFF : MessageSenderType.CUSTOMER;

        messageService.saveMessage(
                conversation,
                senderType,
                StringUtils.hasText(actualSenderId) ? actualSenderId : conversationSenderId,
                text,
                rawPayload,
                messageTime
        );

        handleTextCommand(conversation, senderType, text);
    }

    private void handleTextCommand(Conversation conversation, MessageSenderType senderType, String text) {
        if (!StringUtils.hasText(text)) {
            return;
        }

        String normalized = normalize(text.trim());
        if (senderType == MessageSenderType.CUSTOMER) {
            if (isConfirmCommand(normalized)) {
                Optional<MessengerOrder> confirmedOrder = messengerOrderService.confirmLatestWaitingOrder(conversation);
                if (confirmedOrder.isPresent()) {
                    messengerSendService.sendMessage(conversation.getPageId(), conversation.getSenderId(), CUSTOMER_CONFIRM_REPLY);
                } else {
                    log.info("Customer confirm ignored because no WAITING_CONFIRM draft exists. conversationId={}",
                            conversation.getId());
                }
                return;
            }

            if (isUpdateCommand(normalized)) {
                orderDraftService.applyCustomerUpdate(conversation, stripUpdatePrefix(text));
                return;
            }
        }

        if (senderType == MessageSenderType.STAFF && INTERNAL_CREATE_DRAFT_COMMAND.equals(normalized)) {
            orderDraftService.createOrderDraftFromConversation(conversation.getId());
        }
    }

    private boolean isConfirmCommand(String normalizedText) {
        return "xac nhan".equals(normalizedText) || "xac nhan don hang".equals(normalizedText);
    }

    private boolean isUpdateCommand(String normalizedText) {
        return normalizedText.startsWith("cap nhat lai");
    }

    private String stripUpdatePrefix(String text) {
        int colonIndex = text.indexOf(':');
        if (colonIndex < 0 || colonIndex == text.length() - 1) {
            return text.trim();
        }
        return text.substring(colonIndex + 1).trim();
    }

    private LocalDateTime parseMessageTime(long timestamp) {
        if (timestamp <= 0) {
            return LocalDateTime.now();
        }
        return LocalDateTime.ofInstant(Instant.ofEpochMilli(timestamp), ZoneId.systemDefault());
    }

    private String textValue(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        return node.asText(null);
    }

    private String normalize(String value) {
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('đ', 'd')
                .replace('Đ', 'D');
        return normalized.toLowerCase().trim().replaceAll("\\s+", " ");
    }
}

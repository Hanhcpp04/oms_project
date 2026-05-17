package com.oms.module.messenger.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.common.exception.BusinessException;
import com.oms.module.messenger.entity.Conversation;
import com.oms.module.messenger.entity.Message;
import com.oms.module.messenger.entity.OrderDraft;
import com.oms.module.messenger.enums.MessageSenderType;
import com.oms.module.order.entity.Order;
import com.oms.module.shop.entity.Shop;
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
            "Cảm ơn bạn. Đơn hàng %s đã được tạo và đang chờ nhân viên duyệt. Shop sẽ xử lý đơn hàng sớm nhất có thể.";
    private static final String CUSTOMER_CANCEL_REPLY =
            "Shop đã hủy đơn tạm của bạn.";
    private final ObjectMapper objectMapper;
    private final ConversationService conversationService;
    private final MessageService messageService;
    private final OrderDraftService orderDraftService;
    private final MessengerOrderService messengerOrderService;
    private final MessengerSendService messengerSendService;
    private final MessengerPageResolver messengerPageResolver;

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
        String customerPsid = echo
                ? textValue(event.path("recipient").path("id"))
                : textValue(event.path("sender").path("id"));
        String actualSenderId = textValue(event.path("sender").path("id"));

        if (!StringUtils.hasText(pageId) || !StringUtils.hasText(customerPsid)) {
            log.warn("Messenger message ignored because pageId or customerPsid is missing. event={}", event);
            return;
        }

        String text = textValue(messageNode.path("text"));
        String mid = textValue(messageNode.path("mid"));
        boolean systemEcho = echo && isSystemEcho(mid, text);
        MessageSenderType senderType = systemEcho
                ? MessageSenderType.SYSTEM
                : echo ? MessageSenderType.STAFF : MessageSenderType.CUSTOMER;

        LocalDateTime messageTime = parseMessageTime(event.path("timestamp").asLong(0));
        Conversation conversation = conversationService.getOrCreateFacebookConversation(pageId, customerPsid);

        Optional<Message> savedMessage = messageService.saveMessage(
                conversation,
                senderType,
                StringUtils.hasText(actualSenderId) ? actualSenderId : customerPsid,
                mid,
                echo,
                text,
                rawPayload,
                messageTime
        );
        if (savedMessage.isEmpty()) {
            return;
        }

        handleTextCommand(conversation, savedMessage.get(), senderType, text);
    }

    private void handleTextCommand(
            Conversation conversation,
            Message message,
            MessageSenderType senderType,
            String text
    ) {
        if (!StringUtils.hasText(text) || senderType == MessageSenderType.SYSTEM) {
            return;
        }

        String normalized = normalize(text.trim());
        if (senderType == MessageSenderType.CUSTOMER) {
            handleCustomerMessage(conversation, message, normalized, text);
            return;
        }

        if (senderType == MessageSenderType.STAFF) {
            boolean omsOrderCopyBlock = isOmsOrderCopyBlock(normalized);
            boolean rentalVariantCheckMessage = isRentalVariantCheckMessage(normalized);
            if (!omsOrderCopyBlock && !rentalVariantCheckMessage) {
                return;
            }

            Optional<Shop> shop = messengerPageResolver.resolveShop(conversation.getPageId());
            if (shop.isEmpty()) {
                log.warn("OMS order copy block ignored because page is not linked to a shop. pageId={}, conversationId={}",
                        conversation.getPageId(), conversation.getId());
                return;
            }
            try {
                if (omsOrderCopyBlock) {
                    orderDraftService.createOrderDraftFromSellerMessage(conversation, message, shop.get());
                } else {
                    orderDraftService.checkRentalAvailabilityFromSellerMessage(conversation, message, shop.get());
                }
            } catch (BusinessException ex) {
                log.info("Messenger seller command rejected. conversationId={}, reason={}",
                        conversation.getId(), ex.getMessage());
                messengerSendService.sendSystemMessage(
                        conversation.getPageId(),
                        conversation.getSenderId(),
                        (omsOrderCopyBlock ? "Shop chưa thể tạo đơn tạm: " : "Shop chưa thể kiểm tra lịch thuê: ")
                                + ex.getMessage()
                );
            }
        }
    }

    private void handleCustomerMessage(
            Conversation conversation,
            Message message,
            String normalized,
            String originalText) {
        if (isCancelCommand(normalized)) {
            orderDraftService.findLatestActiveDraft(conversation.getId())
                    .ifPresent(draft -> {
                        orderDraftService.cancel(draft.getId());
                        messengerSendService.sendSystemMessage(
                                conversation.getPageId(),
                                conversation.getSenderId(),
                                CUSTOMER_CANCEL_REPLY
                        );
                    });
            return;
        }

        if (isConfirmCommand(normalized)) {
            confirmCustomerDraft(conversation);
            return;
        }

        Optional<OrderDraft> activeDraft = orderDraftService.findLatestActiveDraft(conversation.getId());
        if (activeDraft.isPresent()
                && orderDraftService.canReceiveCustomerUpdates(activeDraft.get())
                && shouldTreatAsDraftUpdate(normalized, activeDraft.get())) {
            try {
                orderDraftService.applyCustomerUpdate(conversation, stripUpdatePrefix(originalText),
                        activeDraft.get().getShop() != null ? activeDraft.get().getShop().getId() : null);
            } catch (BusinessException ex) {
                log.info("Customer draft update rejected. conversationId={}, reason={}",
                        conversation.getId(), ex.getMessage());
                messengerSendService.sendSystemMessage(
                        conversation.getPageId(),
                        conversation.getSenderId(),
                        "Shop chưa thể cập nhật đơn tạm: " + ex.getMessage()
                );
            }
            return;
        }

        if (activeDraft.isPresent()) {
            return;
        }

        Optional<Shop> shop = messengerPageResolver.resolveShop(conversation.getPageId());
        if (shop.isEmpty()) {
            return;
        }
        try {
            orderDraftService.checkRentalAvailabilityFromCustomerMessage(conversation, message, shop.get());
        } catch (BusinessException ex) {
            log.info("Customer rental availability check rejected. conversationId={}, reason={}",
                    conversation.getId(), ex.getMessage());
            messengerSendService.sendSystemMessage(
                    conversation.getPageId(),
                    conversation.getSenderId(),
                    "Shop chưa thể kiểm tra lịch thuê: " + ex.getMessage()
            );
        }
    }

    private void confirmCustomerDraft(Conversation conversation) {
        Optional<OrderDraft> activeDraft = orderDraftService.findLatestActiveDraft(conversation.getId());
        if (activeDraft.isEmpty()) {
            log.info("Customer confirm ignored because no active draft exists. conversationId={}", conversation.getId());
            return;
        }

        OrderDraft draft = activeDraft.get();
        var missingFields = orderDraftService.findBlockingMissingFields(draft);
        if (!missingFields.isEmpty()) {
            messengerSendService.sendSystemMessage(
                    conversation.getPageId(),
                    conversation.getSenderId(),
                    orderDraftService.buildConfirmMessage(draft)
            );
            log.info("Customer confirm deferred because draft is missing required fields. conversationId={}, draftId={}, missingFields={}",
                    conversation.getId(), draft.getId(), missingFields);
            return;
        }

        try {
            Optional<Order> confirmedOrder = messengerOrderService.confirmLatestWaitingOrder(conversation);
            if (confirmedOrder.isPresent()) {
                messengerSendService.sendSystemMessage(
                        conversation.getPageId(),
                        conversation.getSenderId(),
                        CUSTOMER_CONFIRM_REPLY.formatted(confirmedOrder.get().getOrderCode())
                );
            }
        } catch (BusinessException ex) {
            log.info("Customer confirm rejected. conversationId={}, reason={}", conversation.getId(), ex.getMessage());
            messengerSendService.sendSystemMessage(
                    conversation.getPageId(),
                    conversation.getSenderId(),
                    "Shop chưa thể tạo đơn: " + ex.getMessage()
            );
        }
    }

    private boolean isSystemEcho(String mid, String text) {
        return messengerSendService.isSystemMessageId(mid) || messengerSendService.hasSystemPrefix(text);
    }

    private boolean isOmsOrderCopyBlock(String normalizedText) {
        boolean hasOmsHeader = normalizedText.contains("tao don messenger tu oms")
                || normalizedText.contains("tao don tu oms")
                || normalizedText.contains("tao don cho khach");
        return hasOmsHeader
                && normalizedText.contains("variant id");
    }

    private boolean isRentalVariantCheckMessage(String normalizedText) {
        return normalizedText.contains("variant id")
                && (normalizedText.contains("thue") || normalizedText.contains("rent"));
    }

    private boolean isConfirmCommand(String normalizedText) {
        return "xac nhan".equals(normalizedText)
                || "xac nhan don".equals(normalizedText)
                || "xac nhan don hang".equals(normalizedText)
                || "ok".equals(normalizedText)
                || "dong y".equals(normalizedText)
                || "chot".equals(normalizedText)
                || "chot don".equals(normalizedText);
    }

    private boolean isCancelCommand(String normalizedText) {
        return "huy".equals(normalizedText)
                || "huy don".equals(normalizedText)
                || "huy don tam".equals(normalizedText)
                || "cancel".equals(normalizedText);
    }

    private boolean shouldTreatAsDraftUpdate(String normalizedText, OrderDraft draft) {
        return draft.getStatus() == com.oms.module.messenger.enums.OrderDraftStatus.NEED_MORE_INFO
                || normalizedText.startsWith("sua")
                || normalizedText.startsWith("cap nhat")
                || normalizedText.startsWith("doi")
                || normalizedText.contains("dia chi")
                || normalizedText.contains("sdt")
                || normalizedText.contains("so dien thoai");
    }

    private String stripUpdatePrefix(String text) {
        int colonIndex = text.indexOf(':');
        if (colonIndex >= 0 && colonIndex < text.length() - 1) {
            return text.substring(colonIndex + 1).trim();
        }
        return text.trim();
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
                .replace('\u0111', 'd')
                .replace('\u0110', 'D');
        return normalized.toLowerCase().trim().replaceAll("\\s+", " ");
    }
}

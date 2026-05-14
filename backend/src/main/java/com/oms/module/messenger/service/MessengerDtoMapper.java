package com.oms.module.messenger.service;

import com.oms.module.messenger.dto.ConversationResponse;
import com.oms.module.messenger.dto.MessageResponse;
import com.oms.module.messenger.dto.MessengerOrderResponse;
import com.oms.module.messenger.dto.OrderDraftResponse;
import com.oms.module.messenger.entity.Conversation;
import com.oms.module.messenger.entity.Message;
import com.oms.module.messenger.entity.MessengerOrder;
import com.oms.module.messenger.entity.OrderDraft;
import org.springframework.stereotype.Component;

import java.util.ArrayList;

@Component
public class MessengerDtoMapper {

    public ConversationResponse toConversationResponse(Conversation conversation) {
        if (conversation == null) {
            return null;
        }

        return ConversationResponse.builder()
                .id(conversation.getId())
                .platform(conversation.getPlatform())
                .pageId(conversation.getPageId())
                .senderId(conversation.getSenderId())
                .conversationKey(conversation.getConversationKey())
                .status(conversation.getStatus())
                .lastOrderMarkerTime(conversation.getLastOrderMarkerTime())
                .createdAt(conversation.getCreatedAt())
                .updatedAt(conversation.getUpdatedAt())
                .build();
    }

    public MessageResponse toMessageResponse(Message message) {
        if (message == null) {
            return null;
        }

        return MessageResponse.builder()
                .id(message.getId())
                .conversationId(message.getConversation() != null ? message.getConversation().getId() : null)
                .senderType(message.getSenderType())
                .senderId(message.getSenderId())
                .text(message.getText())
                .rawPayload(message.getRawPayload())
                .messageTime(message.getMessageTime())
                .createdAt(message.getCreatedAt())
                .build();
    }

    public OrderDraftResponse toOrderDraftResponse(OrderDraft draft) {
        if (draft == null) {
            return null;
        }

        return OrderDraftResponse.builder()
                .id(draft.getId())
                .conversationId(draft.getConversation() != null ? draft.getConversation().getId() : null)
                .customerName(draft.getCustomerName())
                .phone(draft.getPhone())
                .address(draft.getAddress())
                .productName(draft.getProductName())
                .productCode(draft.getProductCode())
                .quantity(draft.getQuantity())
                .color(draft.getColor())
                .size(draft.getSize())
                .price(draft.getPrice())
                .note(draft.getNote())
                .missingFields(draft.getMissingFields() != null ? new ArrayList<>(draft.getMissingFields()) : new ArrayList<>())
                .status(draft.getStatus())
                .confirmMessage(draft.getConfirmMessage())
                .createdAt(draft.getCreatedAt())
                .updatedAt(draft.getUpdatedAt())
                .build();
    }

    public MessengerOrderResponse toMessengerOrderResponse(MessengerOrder order) {
        if (order == null) {
            return null;
        }

        return MessengerOrderResponse.builder()
                .id(order.getId())
                .orderDraftId(order.getOrderDraft() != null ? order.getOrderDraft().getId() : null)
                .conversationId(order.getConversation() != null ? order.getConversation().getId() : null)
                .customerName(order.getCustomerName())
                .phone(order.getPhone())
                .address(order.getAddress())
                .productName(order.getProductName())
                .productCode(order.getProductCode())
                .quantity(order.getQuantity())
                .color(order.getColor())
                .size(order.getSize())
                .price(order.getPrice())
                .note(order.getNote())
                .status(order.getStatus())
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .build();
    }
}

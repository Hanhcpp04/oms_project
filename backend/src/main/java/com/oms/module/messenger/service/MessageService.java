package com.oms.module.messenger.service;

import com.oms.module.messenger.entity.Conversation;
import com.oms.module.messenger.entity.Message;
import com.oms.module.messenger.enums.MessageSenderType;
import com.oms.module.messenger.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessageService {

    public static final int DEFAULT_MESSAGE_LIMIT = 200;

    private final MessageRepository messageRepository;

    @Transactional
    public Message saveMessage(
            Conversation conversation,
            MessageSenderType senderType,
            String senderId,
            String text,
            String rawPayload,
            LocalDateTime messageTime
    ) {
        Message message = Message.builder()
                .conversation(conversation)
                .senderType(senderType)
                .senderId(senderId)
                .text(text)
                .rawPayload(rawPayload)
                .messageTime(messageTime != null ? messageTime : LocalDateTime.now())
                .build();

        Message saved = messageRepository.save(message);
        log.debug("Saved Messenger message: messageId={}, conversationId={}, senderType={}",
                saved.getId(), conversation.getId(), senderType);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<Message> getRecentMessagesAsc(Long conversationId, int limit) {
        int safeLimit = safeLimit(limit);
        Pageable pageable = PageRequest.of(0, safeLimit, Sort.by(Sort.Direction.DESC, "messageTime"));
        List<Message> messages = messageRepository.findByConversationIdOrderByMessageTimeDesc(conversationId, pageable);
        Collections.reverse(messages);
        return messages;
    }

    @Transactional(readOnly = true)
    public List<Message> getDraftContextMessages(Conversation conversation, int limit) {
        int safeLimit = safeLimit(limit);
        Pageable pageable = PageRequest.of(0, safeLimit, Sort.by(Sort.Direction.DESC, "messageTime"));

        List<Message> messages;
        if (conversation.getLastOrderMarkerTime() != null) {
            messages = messageRepository.findByConversationIdAndMessageTimeAfterOrderByMessageTimeDesc(
                    conversation.getId(),
                    conversation.getLastOrderMarkerTime(),
                    pageable
            );
        } else {
            messages = messageRepository.findByConversationIdOrderByMessageTimeDesc(conversation.getId(), pageable);
        }

        Collections.reverse(messages);
        return messages;
    }

    private int safeLimit(int limit) {
        if (limit <= 0) {
            return DEFAULT_MESSAGE_LIMIT;
        }
        return Math.min(limit, 500);
    }
}

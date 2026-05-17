package com.oms.module.messenger.service;

import com.oms.module.messenger.entity.Conversation;
import com.oms.module.messenger.entity.Message;
import com.oms.module.messenger.enums.MessageSenderType;
import com.oms.module.messenger.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

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
        return saveMessage(conversation, senderType, senderId, null, false, text, rawPayload, messageTime)
                .orElseThrow(() -> new IllegalStateException("Duplicate Messenger message without mid should not be skipped"));
    }

    @Transactional
    public Optional<Message> saveMessage(
            Conversation conversation,
            MessageSenderType senderType,
            String senderId,
            String mid,
            boolean echo,
            String text,
            String rawPayload,
            LocalDateTime messageTime
    ) {
        if (org.springframework.util.StringUtils.hasText(mid) && messageRepository.existsByMid(mid)) {
            log.debug("Skipping duplicated Messenger message by mid. mid={}, conversationId={}",
                    mid, conversation.getId());
            return Optional.empty();
        }

        Message message = Message.builder()
                .conversation(conversation)
                .senderType(senderType)
                .senderId(senderId)
                .mid(mid)
                .echo(echo)
                .text(text)
                .rawPayload(rawPayload)
                .messageTime(messageTime != null ? messageTime : LocalDateTime.now())
                .build();

        try {
            Message saved = messageRepository.save(message);
            log.debug("Saved Messenger message: messageId={}, mid={}, conversationId={}, senderType={}",
                    saved.getId(), mid, conversation.getId(), senderType);
            return Optional.of(saved);
        } catch (DataIntegrityViolationException ex) {
            if (org.springframework.util.StringUtils.hasText(mid)) {
                log.debug("Skipping duplicated Messenger message after unique constraint hit. mid={}, conversationId={}",
                        mid, conversation.getId());
                return Optional.empty();
            }
            throw ex;
        }
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

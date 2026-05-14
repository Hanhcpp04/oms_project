package com.oms.module.messenger.service;

import com.oms.common.exception.ResourceNotFoundException;
import com.oms.module.messenger.entity.Conversation;
import com.oms.module.messenger.enums.ConversationPlatform;
import com.oms.module.messenger.enums.ConversationStatus;
import com.oms.module.messenger.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class ConversationService {

    private static final String FACEBOOK_PREFIX = "facebook";

    private final ConversationRepository conversationRepository;

    @Transactional
    public Conversation getOrCreateFacebookConversation(String pageId, String senderId) {
        if (!StringUtils.hasText(pageId) || !StringUtils.hasText(senderId)) {
            throw new IllegalArgumentException("pageId and senderId are required");
        }

        String conversationKey = buildFacebookConversationKey(pageId, senderId);
        return conversationRepository.findByConversationKey(conversationKey)
                .orElseGet(() -> {
                    Conversation conversation = Conversation.builder()
                            .platform(ConversationPlatform.FACEBOOK)
                            .pageId(pageId)
                            .senderId(senderId)
                            .conversationKey(conversationKey)
                            .status(ConversationStatus.OPEN)
                            .build();
                    Conversation saved = conversationRepository.save(conversation);
                    log.info("Created Messenger conversation: conversationId={}, conversationKey={}",
                            saved.getId(), conversationKey);
                    return saved;
                });
    }

    @Transactional(readOnly = true)
    public Conversation getById(Long conversationId) {
        return conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation", conversationId));
    }

    @Transactional(readOnly = true)
    public Page<Conversation> getConversations(Pageable pageable) {
        return conversationRepository.findAll(pageable);
    }

    @Transactional
    public void updateLastOrderMarkerTime(Conversation conversation, LocalDateTime markerTime) {
        conversation.setLastOrderMarkerTime(markerTime);
        conversationRepository.save(conversation);
    }

    public String buildFacebookConversationKey(String pageId, String senderId) {
        return FACEBOOK_PREFIX + ":" + pageId + ":" + senderId;
    }
}

package com.oms.module.messenger.dto;

import com.oms.module.messenger.enums.ConversationPlatform;
import com.oms.module.messenger.enums.ConversationStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class ConversationResponse {

    private Long id;
    private ConversationPlatform platform;
    private String pageId;
    private String senderId;
    private String conversationKey;
    private ConversationStatus status;
    private LocalDateTime lastOrderMarkerTime;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

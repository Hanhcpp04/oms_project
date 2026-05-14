package com.oms.module.messenger.dto;

import com.oms.module.messenger.enums.MessageSenderType;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class MessageResponse {

    private Long id;
    private Long conversationId;
    private MessageSenderType senderType;
    private String senderId;
    private String text;
    private String rawPayload;
    private LocalDateTime messageTime;
    private LocalDateTime createdAt;
}

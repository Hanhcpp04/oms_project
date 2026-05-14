package com.oms.module.messenger.entity;

import com.oms.common.base.BaseEntity;
import com.oms.module.messenger.enums.ConversationPlatform;
import com.oms.module.messenger.enums.ConversationStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity(name = "MessengerConversation")
@Table(
        name = "messenger_conversations",
        indexes = {
                @Index(name = "idx_messenger_conversation_key", columnList = "conversation_key", unique = true),
                @Index(name = "idx_messenger_conversation_updated_at", columnList = "updated_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Conversation extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "platform", nullable = false, length = 30)
    @Builder.Default
    private ConversationPlatform platform = ConversationPlatform.FACEBOOK;

    @Column(name = "page_id", nullable = false, length = 100)
    private String pageId;

    @Column(name = "sender_id", nullable = false, length = 100)
    private String senderId;

    @Column(name = "conversation_key", nullable = false, length = 255)
    private String conversationKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private ConversationStatus status = ConversationStatus.OPEN;

    @Column(name = "last_order_marker_time")
    private LocalDateTime lastOrderMarkerTime;
}

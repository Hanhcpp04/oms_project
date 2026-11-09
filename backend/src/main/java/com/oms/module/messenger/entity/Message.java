package com.oms.module.messenger.entity;

import com.oms.common.base.BaseEntity;
import com.oms.module.messenger.enums.MessageSenderType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity(name = "MessengerMessage")
@Table(
        name = "messenger_messages",
        indexes = {
                @Index(name = "ux_messenger_message_mid", columnList = "mid", unique = true),
                @Index(name = "idx_messenger_message_conversation_time", columnList = "conversation_id,message_time"),
                @Index(name = "idx_messenger_message_sender_id", columnList = "sender_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Message extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @Enumerated(EnumType.STRING)
    @Column(name = "sender_type", nullable = false, length = 20, columnDefinition = "enum('CUSTOMER','STAFF','SYSTEM')")
    private MessageSenderType senderType;

    @Column(name = "sender_id", nullable = false, length = 100)
    private String senderId;

    @Column(name = "mid", length = 255)
    private String mid;

    @Column(name = "is_echo", nullable = false)
    @Builder.Default
    private Boolean echo = false;

    @Lob
    @Column(name = "text", columnDefinition = "TEXT")
    private String text;

    @Lob
    @Column(name = "raw_payload", columnDefinition = "LONGTEXT")
    private String rawPayload;

    @Column(name = "message_time", nullable = false)
    private LocalDateTime messageTime;
}

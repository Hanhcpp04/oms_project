package com.oms.module.messenger.entity;

import com.oms.common.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity(name = "MessengerOutboundSystemMessage")
@Table(
        name = "messenger_outbound_system_messages",
        indexes = {
                @Index(name = "ux_messenger_outbound_system_mid", columnList = "message_id", unique = true),
                @Index(name = "idx_messenger_outbound_system_page_recipient", columnList = "page_id,recipient_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OutboundSystemMessage extends BaseEntity {

    @Column(name = "message_id", nullable = false, length = 255)
    private String messageId;

    @Column(name = "page_id", nullable = false, length = 100)
    private String pageId;

    @Column(name = "recipient_id", nullable = false, length = 100)
    private String recipientId;

    @Lob
    @Column(name = "text", columnDefinition = "TEXT")
    private String text;
}

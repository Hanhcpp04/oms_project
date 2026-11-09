package com.oms.module.messenger.entity;

import com.oms.common.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity(name = "MessengerOutboundQueueItem")
@Table(name = "messenger_outbound_queue", indexes = {
        @Index(name = "idx_messenger_outbound_queue_due", columnList = "status,next_attempt_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OutboundQueueItem extends BaseEntity {

    @Column(name = "page_id", nullable = false, length = 100)
    private String pageId;

    @Column(name = "recipient_id", nullable = false, length = 100)
    private String recipientId;

    @Enumerated(EnumType.STRING)
    @Column(name = "payload_type", nullable = false, length = 20)
    private PayloadType payloadType;

    @Lob
    @Column(name = "payload", nullable = false, columnDefinition = "TEXT")
    private String payload;

    @Column(name = "attempts", nullable = false)
    @Builder.Default
    private int attempts = 0;

    @Column(name = "next_attempt_at", nullable = false)
    private LocalDateTime nextAttemptAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private QueueStatus status = QueueStatus.PENDING;

    @Column(name = "last_error", length = 500)
    private String lastError;

    public enum PayloadType { TEXT, IMAGE }
    public enum QueueStatus { PENDING, DEAD }
}

package com.oms.module.notification.dto;

import com.oms.module.notification.entity.Notification;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class NotificationResponse {

    private Long id;
    private Notification.Type type;
    private Notification.Severity severity;
    private String title;
    private String message;
    private String entityType;
    private Long entityId;
    private String linkUrl;
    private String payloadJson;
    private Boolean read;
    private LocalDateTime readAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

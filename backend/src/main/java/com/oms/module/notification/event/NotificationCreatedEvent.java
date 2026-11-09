package com.oms.module.notification.event;

import com.oms.module.notification.dto.NotificationResponse;

public record NotificationCreatedEvent(
        Long shopId,
        NotificationResponse notification
) {
}

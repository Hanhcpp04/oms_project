package com.oms.module.messenger.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MessengerSendResult {

    private boolean sent;
    private String messageId;

    public static MessengerSendResult notSent() {
        return MessengerSendResult.builder().sent(false).build();
    }
}

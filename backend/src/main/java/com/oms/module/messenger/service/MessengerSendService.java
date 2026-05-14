package com.oms.module.messenger.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@Slf4j
public class MessengerSendService {

    public boolean sendMessage(String pageId, String recipientId, String text) {
        if (!StringUtils.hasText(text)) {
            return false;
        }

        log.info("Messenger send service is not configured. pageId={}, recipientId={}, message={}",
                pageId, recipientId, text);
        return false;
    }
}

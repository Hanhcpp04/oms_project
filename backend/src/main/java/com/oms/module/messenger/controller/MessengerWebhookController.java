package com.oms.module.messenger.controller;

import com.oms.config.MessengerProperties;
import com.oms.module.messenger.service.MessengerWebhookService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequiredArgsConstructor
public class MessengerWebhookController {

    private static final String SUBSCRIBE_MODE = "subscribe";

    private final MessengerProperties messengerProperties;
    private final MessengerWebhookService messengerWebhookService;

    @GetMapping(value = "/webhook", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> verifyWebhook(
            @RequestParam(value = "hub.mode", required = false) String mode,
            @RequestParam(value = "hub.verify_token", required = false) String verifyToken,
            @RequestParam(value = "hub.challenge", required = false) String challenge) {

        boolean tokenMatched = StringUtils.hasText(messengerProperties.getVerifyToken())
                && messengerProperties.getVerifyToken().equals(verifyToken);

        log.info("Messenger webhook verification request received: mode={}, tokenMatched={}",
                mode, tokenMatched);

        if (SUBSCRIBE_MODE.equals(mode) && tokenMatched && challenge != null) {
            log.info("Messenger webhook verification succeeded");
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(challenge);
        }

        log.warn("Messenger webhook verification failed: mode={}, tokenMatched={}",
                mode, tokenMatched);
        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }

    @PostMapping(value = "/webhook", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> receiveEvent(@RequestBody String body) {
        log.info("Messenger webhook event received. Raw body: {}", body);
        messengerWebhookService.handleWebhook(body);
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .body("EVENT_RECEIVED");
    }
}

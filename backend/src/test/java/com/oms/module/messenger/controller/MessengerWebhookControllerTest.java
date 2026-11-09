package com.oms.module.messenger.controller;

import com.oms.config.MessengerProperties;
import com.oms.module.messenger.service.MessengerWebhookService;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class MessengerWebhookControllerTest {

    @Test
    void shouldRejectMissingSignatureWhenAppSecretIsConfigured() {
        MessengerProperties properties = new MessengerProperties();
        properties.setAppSecret("secret");
        var service = mock(MessengerWebhookService.class);
        var controller = new MessengerWebhookController(properties, service);

        var response = controller.receiveEvent("{}".getBytes(StandardCharsets.UTF_8), null);

        assertThat(response.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void shouldAcceptValidSignature() throws Exception {
        byte[] body = "{\"entry\":[]}".getBytes(StandardCharsets.UTF_8);
        MessengerProperties properties = new MessengerProperties();
        properties.setAppSecret("secret");
        var service = mock(MessengerWebhookService.class);
        var controller = new MessengerWebhookController(properties, service);

        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec("secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String signature = "sha256=" + HexFormat.of().formatHex(mac.doFinal(body));

        var response = controller.receiveEvent(body, signature);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        verify(service).handleWebhook(new String(body, StandardCharsets.UTF_8));
    }
}

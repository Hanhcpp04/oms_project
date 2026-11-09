package com.oms.module.messenger.event;

public record OrderCreatedFromMessengerEvent(
        Long shopId,
        Long orderId,
        Long draftId,
        String customerPsid,
        String source
) {
}

package com.oms.module.order.service;

import com.oms.module.messenger.event.OrderCreatedFromMessengerEvent;
import com.oms.module.order.dto.OrderRealtimeEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class OrderRealtimeService {

    private static final long SSE_TIMEOUT_MS = TimeUnit.MINUTES.toMillis(30);
    private static final long RECONNECT_TIME_MS = TimeUnit.SECONDS.toMillis(5);

    private final Map<Long, Set<SseEmitter>> emittersByShopId = new ConcurrentHashMap<>();

    public SseEmitter subscribe(Long shopId) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        Set<SseEmitter> emitters = emittersByShopId.computeIfAbsent(shopId, ignored -> ConcurrentHashMap.newKeySet());
        emitters.add(emitter);

        emitter.onCompletion(() -> removeEmitter(shopId, emitter));
        emitter.onTimeout(() -> removeEmitter(shopId, emitter));
        emitter.onError(error -> removeEmitter(shopId, emitter));

        send(emitter, "connected", Map.of("type", "CONNECTED"));
        return emitter;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderCreatedFromMessenger(OrderCreatedFromMessengerEvent event) {
        if (event.shopId() == null) {
            log.warn("Skip realtime order event because shopId is null: orderId={}", event.orderId());
            return;
        }

        publishToShop(
                event.shopId(),
                "order-created-from-messenger",
                OrderRealtimeEvent.orderCreatedFromMessenger(
                        event.orderId(),
                        event.draftId(),
                        event.customerPsid()
                )
        );
    }

    private void publishToShop(Long shopId, String eventName, Object payload) {
        Set<SseEmitter> emitters = emittersByShopId.get(shopId);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }

        for (SseEmitter emitter : emitters) {
            if (!send(emitter, eventName, payload)) {
                removeEmitter(shopId, emitter);
            }
        }
    }

    private boolean send(SseEmitter emitter, String eventName, Object payload) {
        try {
            emitter.send(SseEmitter.event()
                    .name(eventName)
                    .reconnectTime(RECONNECT_TIME_MS)
                    .data(payload));
            return true;
        } catch (IOException | RuntimeException ex) {
            log.debug("Remove closed order realtime SSE emitter: {}", ex.getMessage());
            return false;
        }
    }

    private void removeEmitter(Long shopId, SseEmitter emitter) {
        Set<SseEmitter> emitters = emittersByShopId.get(shopId);
        if (emitters == null) {
            return;
        }

        emitters.remove(emitter);
        if (emitters.isEmpty()) {
            emittersByShopId.remove(shopId);
        }
    }
}

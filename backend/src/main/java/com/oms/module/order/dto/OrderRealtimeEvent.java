package com.oms.module.order.dto;

public record OrderRealtimeEvent(
        String type,
        Long orderId,
        Long draftId,
        String customerPsid,
        String source
) {
    public static final String ORDER_CREATED_FROM_MESSENGER = "ORDER_CREATED_FROM_MESSENGER";

    public static OrderRealtimeEvent orderCreatedFromMessenger(
            Long orderId,
            Long draftId,
            String customerPsid
    ) {
        return new OrderRealtimeEvent(
                ORDER_CREATED_FROM_MESSENGER,
                orderId,
                draftId,
                customerPsid,
                "MESSENGER"
        );
    }
}

package com.oms.module.messenger.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CreateOrderDraftResponse {

    private OrderDraftResponse orderDraft;
    private String confirmMessage;
    private boolean messengerSent;
}

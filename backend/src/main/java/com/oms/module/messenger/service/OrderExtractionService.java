package com.oms.module.messenger.service;

import com.oms.module.messenger.dto.OrderInfoExtractedDto;
import com.oms.module.messenger.entity.Message;

import java.util.List;

public interface OrderExtractionService {

    default OrderInfoExtractedDto extractOrderInfo(List<Message> messages) {
        return extractOrderInfo(messages, null);
    }

    OrderInfoExtractedDto extractOrderInfo(List<Message> messages, Long shopId);
}

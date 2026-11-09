package com.oms.module.order.service;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.module.order.entity.Order;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class OrderStatusTransitionService {

    public void assertCanTransition(Order order, Order.OrderStatus targetStatus) {
        if (order == null) {
            throw new BusinessException(ErrorCode.ORDER_NOT_FOUND);
        }
        if (targetStatus == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Status must not be null");
        }
        if (!order.canTransitionTo(targetStatus)) {
            throw new BusinessException(
                    ErrorCode.ORDER_INVALID_STATUS,
                    "Cannot transition order from " + order.getStatus() + " to " + targetStatus
            );
        }
    }
}

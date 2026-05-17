package com.oms.module.order.service;

import com.oms.module.messenger.service.MessengerSendService;
import com.oms.module.order.entity.Order;
import com.oms.module.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderPaymentTimeoutScheduler {

    private final OrderRepository orderRepository;
    private final OrderService orderService;
    private final MessengerSendService messengerSendService;

    @Value("${app.payment.timeout.cancel-minutes:30}")
    private int cancelMinutes;

    @Value("${app.payment.timeout.reminder-minutes:25}")
    private int reminderMinutes;

    // Run every minute
    @Scheduled(fixedDelay = 60000)
    @Transactional
    public void processPaymentTimeouts() {
        LocalDateTime now = LocalDateTime.now();

        List<Order.SourceMethod> autoCancelSources = List.of(Order.SourceMethod.PUBLIC_FORM, Order.SourceMethod.MESSENGER);

        // 1. Process 30-minute cancellations
        LocalDateTime cancelThreshold = now.minusMinutes(cancelMinutes);
        List<Order> ordersToCancel = orderRepository.findOrdersPendingPaymentCancellation(
                Order.OrderStatus.CONFIRMED,
                Order.PaymentStatus.UNPAID,
                Order.PaymentMethod.BANK_TRANSFER,
                autoCancelSources,
                cancelThreshold
        );
        ordersToCancel.addAll(orderRepository.findOrdersPendingPaymentCancellation(
                Order.OrderStatus.PENDING,
                Order.PaymentStatus.UNPAID,
                Order.PaymentMethod.BANK_TRANSFER,
                autoCancelSources,
                cancelThreshold
        ));

        for (Order order : ordersToCancel) {
            try {
                // Cancel the order
                orderService.updateStatus(order.getShop().getId(), order.getId(), Order.OrderStatus.CANCELLED, (Long) null);
                log.info("Auto-cancelled unpaid order: {}", order.getOrderCode());

                // Notify via Messenger if applicable
                if (StringUtils.hasText(order.getMessengerPageId()) && StringUtils.hasText(order.getMessengerCustomerPsid())) {
                    messengerSendService.sendSystemMessage(
                            order.getMessengerPageId(),
                            order.getMessengerCustomerPsid(),
                            "Đơn hàng " + order.getOrderCode() + " của bạn đã bị hủy do chưa nhận được thanh toán trong thời gian quy định (" + cancelMinutes + " phút)."
                    );
                }
            } catch (Exception ex) {
                log.error("Failed to auto-cancel order: {}", order.getOrderCode(), ex);
            }
        }

        // 2. Process 25-minute reminders
        LocalDateTime reminderThreshold = now.minusMinutes(reminderMinutes);
        List<Order> ordersToRemind = orderRepository.findOrdersPendingPaymentReminder(
                Order.OrderStatus.CONFIRMED,
                Order.PaymentStatus.UNPAID,
                Order.PaymentMethod.BANK_TRANSFER,
                autoCancelSources,
                reminderThreshold
        );
        ordersToRemind.addAll(orderRepository.findOrdersPendingPaymentReminder(
                Order.OrderStatus.PENDING,
                Order.PaymentStatus.UNPAID,
                Order.PaymentMethod.BANK_TRANSFER,
                autoCancelSources,
                reminderThreshold
        ));

        for (Order order : ordersToRemind) {
            try {
                order.setPaymentReminderSent(true);
                orderRepository.save(order);
                log.info("Sending payment reminder for order: {}", order.getOrderCode());

                int remainingTime = cancelMinutes - reminderMinutes;
                // Notify via Messenger if applicable
                if (StringUtils.hasText(order.getMessengerPageId()) && StringUtils.hasText(order.getMessengerCustomerPsid())) {
                    messengerSendService.sendSystemMessage(
                            order.getMessengerPageId(),
                            order.getMessengerCustomerPsid(),
                            "Đơn hàng " + order.getOrderCode() + " của bạn sẽ bị hủy sau " + remainingTime + " phút nữa nếu chưa được thanh toán."
                    );
                }
            } catch (Exception ex) {
                log.error("Failed to send payment reminder for order: {}", order.getOrderCode(), ex);
            }
        }
    }
}

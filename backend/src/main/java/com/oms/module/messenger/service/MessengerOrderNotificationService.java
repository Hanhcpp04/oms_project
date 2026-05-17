package com.oms.module.messenger.service;

import com.oms.module.messenger.dto.MessengerSendResult;
import com.oms.module.order.entity.Order;
import com.oms.module.order.service.PublicOrderTrackingTokenService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessengerOrderNotificationService {

    private final MessengerSendService messengerSendService;
    private final PublicOrderTrackingTokenService trackingTokenService;

    @Value("${app.public.frontend-base-url:http://localhost:4200}")
    private String frontendBaseUrl;

    public void notifyOrderConfirmed(Order order) {
        if (!canNotify(order)) {
            return;
        }

        String trackingUrl = buildTrackingUrl(trackingTokenService.createToken(order));
        String message = buildConfirmedMessage(order, trackingUrl);
        MessengerSendResult result = messengerSendService.sendSystemMessage(
                order.getMessengerPageId(),
                order.getMessengerCustomerPsid(),
                message
        );

        if (!result.isSent()) {
            log.info("Messenger order confirmation was not sent. orderId={}, pageId={}, customerPsid={}",
                    order.getId(), order.getMessengerPageId(), order.getMessengerCustomerPsid());
        }
    }

    private boolean canNotify(Order order) {
        return order != null
                && order.getSourceMethod() == Order.SourceMethod.MESSENGER
                && StringUtils.hasText(order.getMessengerPageId())
                && StringUtils.hasText(order.getMessengerCustomerPsid())
                && order.getId() != null
                && StringUtils.hasText(order.getOrderCode());
    }

    private String buildConfirmedMessage(Order order, String trackingUrl) {
        String typeLabel = order.getOrderType() == Order.OrderType.RENT ? "thuê" : "mua";
        return """
                Đơn hàng %s của bạn đã được shop xác nhận.
                Loại đơn: %s
                Theo dõi trạng thái đơn hàng tại:
                %s
                """.formatted(order.getOrderCode(), typeLabel, trackingUrl).trim();
    }

    private String buildTrackingUrl(String token) {
        return trimTrailingSlash(resolveFrontendBaseUrl()) + "/track-order/" + token;
    }

    private String resolveFrontendBaseUrl() {
        if (StringUtils.hasText(frontendBaseUrl)) {
            return frontendBaseUrl.trim();
        }

        return "http://localhost:4200";
    }

    private String trimTrailingSlash(String value) {
        String result = value;
        while (result.endsWith("/")) {
            result = result.substring(0, result.length() - 1);
        }
        return result;
    }
}

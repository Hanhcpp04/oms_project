package com.oms.module.messenger.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.common.exception.BusinessException;
import com.oms.module.messenger.entity.Conversation;
import com.oms.module.messenger.entity.Message;
import com.oms.module.messenger.entity.OrderDraft;
import com.oms.module.messenger.enums.MessageSenderType;
import com.oms.module.order.entity.Order;
import com.oms.module.order.service.PublicOrderTrackingTokenService;
import com.oms.module.payment.dto.PaymentCheckoutResponse;
import com.oms.module.payment.entity.Payment;
import com.oms.module.payment.service.PaymentService;
import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.entity.ShopPaymentConfig;
import com.oms.module.shop.repository.ShopPaymentConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessengerWebhookService {

    private static final String CUSTOMER_CONFIRM_REPLY =
            "Cảm ơn bạn. Đơn hàng %s đã được tạo và đang chờ nhân viên duyệt. Shop sẽ xử lý đơn hàng sớm nhất có thể.";
    private static final String CUSTOMER_CANCEL_REPLY =
            "Shop đã hủy đơn tạm của bạn.";
    private final ObjectMapper objectMapper;
    private final ConversationService conversationService;
    private final MessageService messageService;
    private final OrderDraftService orderDraftService;
    private final MessengerOrderService messengerOrderService;
    private final MessengerSendService messengerSendService;
    private final MessengerPageResolver messengerPageResolver;
    private final PaymentService paymentService;
    private final ShopPaymentConfigRepository paymentConfigRepository;
    private final PublicOrderTrackingTokenService trackingTokenService;

    @Value("${app.public.frontend-base-url:http://localhost:4200}")
    private String frontendBaseUrl;

    @Transactional
    public void handleWebhook(String body) {
        try {
            JsonNode root = objectMapper.readTree(body);
            JsonNode entries = root.path("entry");
            if (!entries.isArray()) {
                log.warn("Messenger webhook payload has no entry array");
                return;
            }

            for (JsonNode entry : entries) {
                JsonNode messagingEvents = entry.path("messaging");
                if (!messagingEvents.isArray()) {
                    continue;
                }

                for (JsonNode messagingEvent : messagingEvents) {
                    processMessagingEvent(messagingEvent, body);
                }
            }
        } catch (Exception ex) {
            log.error("Failed to process Messenger webhook payload", ex);
        }
    }

    protected void processMessagingEvent(JsonNode event, String rawPayload) {
        JsonNode messageNode = event.path("message");
        if (messageNode.isMissingNode() || messageNode.isNull()) {
            return;
        }

        boolean echo = messageNode.path("is_echo").asBoolean(false);
        String pageId = echo
                ? textValue(event.path("sender").path("id"))
                : textValue(event.path("recipient").path("id"));
        String customerPsid = echo
                ? textValue(event.path("recipient").path("id"))
                : textValue(event.path("sender").path("id"));
        String actualSenderId = textValue(event.path("sender").path("id"));

        if (!StringUtils.hasText(pageId) || !StringUtils.hasText(customerPsid)) {
            log.warn("Messenger message ignored because pageId or customerPsid is missing. event={}", event);
            return;
        }

        String text = textValue(messageNode.path("text"));
        String mid = textValue(messageNode.path("mid"));
        boolean systemEcho = echo && isSystemEcho(mid, text);
        MessageSenderType senderType = systemEcho
                ? MessageSenderType.SYSTEM
                : echo ? MessageSenderType.STAFF : MessageSenderType.CUSTOMER;

        LocalDateTime messageTime = parseMessageTime(event.path("timestamp").asLong(0));
        Conversation conversation = conversationService.getOrCreateFacebookConversation(pageId, customerPsid);

        Optional<Message> savedMessage = messageService.saveMessage(
                conversation,
                senderType,
                StringUtils.hasText(actualSenderId) ? actualSenderId : customerPsid,
                mid,
                echo,
                text,
                rawPayload,
                messageTime
        );
        if (savedMessage.isEmpty()) {
            return;
        }

        handleTextCommand(conversation, savedMessage.get(), senderType, text);
    }

    private void handleTextCommand(
            Conversation conversation,
            Message message,
            MessageSenderType senderType,
            String text
    ) {
        if (!StringUtils.hasText(text) || senderType == MessageSenderType.SYSTEM) {
            return;
        }

        String normalized = normalize(text.trim());
        if (senderType == MessageSenderType.CUSTOMER) {
            handleCustomerMessage(conversation, message, normalized, text);
            return;
        }

        if (senderType == MessageSenderType.STAFF) {
            boolean omsOrderCopyBlock = isOmsOrderCopyBlock(normalized);
            boolean rentalVariantCheckMessage = isRentalVariantCheckMessage(normalized);
            if (!omsOrderCopyBlock && !rentalVariantCheckMessage) {
                return;
            }

            Optional<Shop> shop = messengerPageResolver.resolveShop(conversation.getPageId());
            if (shop.isEmpty()) {
                log.warn("OMS order copy block ignored because page is not linked to a shop. pageId={}, conversationId={}",
                        conversation.getPageId(), conversation.getId());
                return;
            }
            try {
                if (omsOrderCopyBlock) {
                    orderDraftService.createOrderDraftFromSellerMessage(conversation, message, shop.get());
                } else {
                    orderDraftService.checkRentalAvailabilityFromSellerMessage(conversation, message, shop.get());
                }
            } catch (BusinessException ex) {
                log.info("Messenger seller command rejected. conversationId={}, reason={}",
                        conversation.getId(), ex.getMessage());
                messengerSendService.sendSystemMessage(
                        conversation.getPageId(),
                        conversation.getSenderId(),
                        (omsOrderCopyBlock ? "Shop chưa thể tạo đơn tạm: " : "Shop chưa thể kiểm tra lịch thuê: ")
                                + ex.getMessage()
                );
            }
        }
    }

    private void handleCustomerMessage(
            Conversation conversation,
            Message message,
            String normalized,
            String originalText) {
        if (isCancelCommand(normalized)) {
            orderDraftService.findLatestActiveDraft(conversation.getId())
                    .ifPresent(draft -> {
                        orderDraftService.cancel(draft.getId());
                        messengerSendService.sendSystemMessage(
                                conversation.getPageId(),
                                conversation.getSenderId(),
                                CUSTOMER_CANCEL_REPLY
                        );
                    });
            return;
        }

        if (isConfirmCommand(normalized)) {
            confirmCustomerDraft(conversation);
            return;
        }

        Optional<OrderDraft> activeDraft = orderDraftService.findLatestActiveDraft(conversation.getId());
        if (activeDraft.isPresent()) {
            Optional<PaymentSelection> paymentSelection = resolvePaymentSelection(normalized, activeDraft.get());
            if (paymentSelection.isPresent()) {
                confirmCustomerDraftWithPayment(conversation, activeDraft.get(), paymentSelection.get());
                return;
            }
        }

        if (activeDraft.isPresent()
                && orderDraftService.canReceiveCustomerUpdates(activeDraft.get())
                && shouldTreatAsDraftUpdate(normalized, activeDraft.get())) {
            try {
                orderDraftService.applyCustomerUpdate(conversation, stripUpdatePrefix(originalText),
                        activeDraft.get().getShop() != null ? activeDraft.get().getShop().getId() : null);
            } catch (BusinessException ex) {
                log.info("Customer draft update rejected. conversationId={}, reason={}",
                        conversation.getId(), ex.getMessage());
                messengerSendService.sendSystemMessage(
                        conversation.getPageId(),
                        conversation.getSenderId(),
                        "Shop chưa thể cập nhật đơn tạm: " + ex.getMessage()
                );
            }
            return;
        }

        if (activeDraft.isPresent()) {
            return;
        }

        Optional<Shop> shop = messengerPageResolver.resolveShop(conversation.getPageId());
        if (shop.isEmpty()) {
            return;
        }
        try {
            orderDraftService.checkRentalAvailabilityFromCustomerMessage(conversation, message, shop.get());
        } catch (BusinessException ex) {
            log.info("Customer rental availability check rejected. conversationId={}, reason={}",
                    conversation.getId(), ex.getMessage());
            messengerSendService.sendSystemMessage(
                    conversation.getPageId(),
                    conversation.getSenderId(),
                    "Shop chưa thể kiểm tra lịch thuê: " + ex.getMessage()
            );
        }
    }

    private void confirmCustomerDraft(Conversation conversation) {
        Optional<OrderDraft> activeDraft = orderDraftService.findLatestActiveDraft(conversation.getId());
        if (activeDraft.isEmpty()) {
            log.info("Customer confirm ignored because no active draft exists. conversationId={}", conversation.getId());
            return;
        }

        OrderDraft draft = activeDraft.get();
        var missingFields = orderDraftService.findBlockingMissingFields(draft);
        if (!missingFields.isEmpty()) {
            messengerSendService.sendSystemMessage(
                    conversation.getPageId(),
                    conversation.getSenderId(),
                    orderDraftService.buildConfirmMessage(draft)
            );
            log.info("Customer confirm deferred because draft is missing required fields. conversationId={}, draftId={}, missingFields={}",
                    conversation.getId(), draft.getId(), missingFields);
            return;
        }

        try {
            messengerSendService.sendSystemMessage(
                    conversation.getPageId(),
                    conversation.getSenderId(),
                    buildPaymentSelectionMessage(draft)
            );
        } catch (BusinessException ex) {
            log.info("Customer confirm rejected. conversationId={}, reason={}", conversation.getId(), ex.getMessage());
            messengerSendService.sendSystemMessage(
                    conversation.getPageId(),
                    conversation.getSenderId(),
                    "Shop chưa thể tạo đơn: " + ex.getMessage()
            );
        }
    }

    private void confirmCustomerDraftWithPayment(
            Conversation conversation,
            OrderDraft draft,
            PaymentSelection selection
    ) {
        var missingFields = orderDraftService.findBlockingMissingFields(draft);
        if (!missingFields.isEmpty()) {
            messengerSendService.sendSystemMessage(
                    conversation.getPageId(),
                    conversation.getSenderId(),
                    orderDraftService.buildConfirmMessage(draft)
            );
            return;
        }

        try {
            Optional<Order> confirmedOrder = messengerOrderService.confirmLatestWaitingOrder(
                    conversation,
                    selection.paymentMethod()
            );
            if (confirmedOrder.isEmpty()) {
                return;
            }

            Order order = confirmedOrder.get();
            if (selection.paymentMethod() == Order.PaymentMethod.COD) {
                messengerSendService.sendSystemMessage(
                        conversation.getPageId(),
                        conversation.getSenderId(),
                        CUSTOMER_CONFIRM_REPLY.formatted(order.getOrderCode())
                );
                return;
            }

            PaymentCheckoutResponse checkout = paymentService.createPayosCheckout(order, selection.paymentPurpose());
            sendPayosPaymentInstruction(conversation, order, checkout, selection);
        } catch (BusinessException ex) {
            log.info("Customer payment selection rejected. conversationId={}, reason={}",
                    conversation.getId(), ex.getMessage());
            messengerSendService.sendSystemMessage(
                    conversation.getPageId(),
                    conversation.getSenderId(),
                    "Shop chưa thể tạo thanh toán cho đơn: " + ex.getMessage()
            );
        }
    }

    private void sendPayosPaymentInstruction(
            Conversation conversation,
            Order order,
            PaymentCheckoutResponse checkout,
            PaymentSelection selection
    ) {
        if (StringUtils.hasText(checkout.getQrImageUrl())) {
            messengerSendService.sendImage(
                    conversation.getPageId(),
                    conversation.getSenderId(),
                    checkout.getQrImageUrl()
            );
        }

        String trackingUrl = buildTrackingUrl(order);
        String message = """
                Đơn %s đã được tạo.
                Hình thức: %s
                Số tiền: %s
                Nội dung chuyển khoản: %s

                Trang theo dõi đơn hàng:
                %s

                Sau khi thanh toán thành công, hệ thống sẽ tự cập nhật trạng thái đơn.
                """.formatted(
                order.getOrderCode(),
                selection.label(),
                formatMoney(checkout.getAmount()),
                valueOrFallback(checkout.getDescription(), "--"),
                trackingUrl
        ).trim();

        messengerSendService.sendSystemMessage(
                conversation.getPageId(),
                conversation.getSenderId(),
                message
        );
    }

    private String buildPaymentSelectionMessage(OrderDraft draft) {
        ShopPaymentConfig config = draft.getShop() != null && draft.getShop().getId() != null
                ? paymentConfigRepository.findByShopId(draft.getShop().getId()).orElse(null)
                : null;

        if (draft.getOrderType() == Order.OrderType.RENT) {
            return buildRentalPaymentSelectionMessage(draft, config);
        }

        return buildSellPaymentSelectionMessage(config);
    }

    private String buildSellPaymentSelectionMessage(ShopPaymentConfig config) {
        StringBuilder builder = new StringBuilder();
        builder.append("Thông tin đơn đã được xác nhận. Bạn vui lòng chọn phương thức thanh toán:\n");

        boolean hasOption = false;
        if (config != null && Boolean.TRUE.equals(config.getCodEnabled())) {
            builder.append("- Nhắn \"COD\" để thanh toán khi nhận hàng.\n");
            hasOption = true;
        }
        if (config != null && Boolean.TRUE.equals(config.getBankTransferEnabled()) && paymentService.canCreatePayosCheckout()) {
            builder.append("- Nhắn \"Chuyển khoản\" để nhận QR thanh toán.\n");
            hasOption = true;
        }

        if (!hasOption) {
            return "Shop chưa cấu hình phương thức thanh toán khả dụng cho đơn Messenger. Vui lòng chờ shop hỗ trợ.";
        }

        builder.append("\nNếu cần sửa thông tin, bạn vẫn có thể nhắn \"Sửa địa chỉ...\" hoặc \"Hủy đơn\".");
        return builder.toString().trim();
    }

    private String buildRentalPaymentSelectionMessage(OrderDraft draft, ShopPaymentConfig config) {
        if (config == null || !Boolean.TRUE.equals(config.getBankTransferEnabled()) || !paymentService.canCreatePayosCheckout()) {
            return "Shop chưa cấu hình thanh toán chuyển khoản tự động cho đơn thuê. Vui lòng chờ shop hỗ trợ.";
        }

        StringBuilder builder = new StringBuilder();
        builder.append("Thông tin đơn thuê đã được xác nhận. Bạn vui lòng chọn khoản thanh toán:\n");
        if (resolveDraftDepositAmount(draft).compareTo(BigDecimal.ZERO) > 0) {
            builder.append("- Nhắn \"Đặt cọc\" để thanh toán tiền cọc ")
                    .append(formatMoney(resolveDraftDepositAmount(draft)))
                    .append(".\n");
        }
        builder.append("- Nhắn \"Tất toán\" để thanh toán toàn bộ ")
                .append(formatMoney(draft.getTotalAmount()))
                .append(".\n");
        builder.append("\nHệ thống sẽ gửi QR payOS sau khi bạn chọn.");
        return builder.toString().trim();
    }

    private Optional<PaymentSelection> resolvePaymentSelection(String normalized, OrderDraft draft) {
        if (!StringUtils.hasText(normalized) || draft == null) {
            return Optional.empty();
        }

        if (draft.getOrderType() == Order.OrderType.RENT) {
            if (isRentalDepositPaymentCommand(normalized)) {
                return Optional.of(new PaymentSelection(
                        Order.PaymentMethod.BANK_TRANSFER,
                        Payment.Purpose.RENTAL_DEPOSIT,
                        "Đặt cọc qua chuyển khoản"
                ));
            }
            if (isRentalFullPaymentCommand(normalized) || isBankTransferCommand(normalized)) {
                return Optional.of(new PaymentSelection(
                        Order.PaymentMethod.BANK_TRANSFER,
                        Payment.Purpose.ORDER_FULL,
                        "Tất toán qua chuyển khoản"
                ));
            }
            return Optional.empty();
        }

        if (isCodCommand(normalized)) {
            return Optional.of(new PaymentSelection(
                    Order.PaymentMethod.COD,
                    null,
                    "COD"
            ));
        }
        if (isBankTransferCommand(normalized)) {
            return Optional.of(new PaymentSelection(
                    Order.PaymentMethod.BANK_TRANSFER,
                    Payment.Purpose.ORDER_FULL,
                    "Chuyển khoản"
            ));
        }

        return Optional.empty();
    }

    private boolean isCodCommand(String normalizedText) {
        return "cod".equals(normalizedText)
                || normalizedText.contains("thanh toan khi nhan")
                || normalizedText.contains("tra tien khi nhan")
                || normalizedText.contains("nhan hang tra tien");
    }

    private boolean isBankTransferCommand(String normalizedText) {
        return "ck".equals(normalizedText)
                || "qr".equals(normalizedText)
                || normalizedText.contains("chuyen khoan")
                || normalizedText.contains("quyet qr")
                || normalizedText.contains("quet qr")
                || normalizedText.contains("bank");
    }

    private boolean isRentalDepositPaymentCommand(String normalizedText) {
        return normalizedText.contains("dat coc")
                || normalizedText.equals("coc")
                || normalizedText.contains("tien coc")
                || normalizedText.contains("chuyen khoan coc");
    }

    private boolean isRentalFullPaymentCommand(String normalizedText) {
        return normalizedText.contains("tat toan")
                || normalizedText.contains("thanh toan het")
                || normalizedText.contains("thanh toan toan bo")
                || normalizedText.contains("tra het")
                || normalizedText.equals("full");
    }

    private BigDecimal resolveDraftDepositAmount(OrderDraft draft) {
        if (draft == null || draft.getDepositAmount() == null) {
            return BigDecimal.ZERO;
        }
        return draft.getDepositAmount();
    }

    private String buildTrackingUrl(Order order) {
        return trimTrailingSlash(resolveFrontendBaseUrl()) + "/track-order/" + trackingTokenService.createToken(order);
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

    private String formatMoney(BigDecimal amount) {
        if (amount == null) {
            return "--";
        }
        return amount.setScale(0, java.math.RoundingMode.HALF_UP).toPlainString() + " VND";
    }

    private String valueOrFallback(String value, String fallback) {
        return StringUtils.hasText(value) ? value : fallback;
    }

    private boolean isSystemEcho(String mid, String text) {
        return messengerSendService.isSystemMessageId(mid) || messengerSendService.hasSystemPrefix(text);
    }

    private boolean isOmsOrderCopyBlock(String normalizedText) {
        boolean hasOmsHeader = normalizedText.contains("tao don messenger tu oms")
                || normalizedText.contains("tao don tu oms")
                || normalizedText.contains("tao don cho khach");
        return hasOmsHeader
                && normalizedText.contains("variant id");
    }

    private boolean isRentalVariantCheckMessage(String normalizedText) {
        return normalizedText.contains("variant id")
                && (normalizedText.contains("thue") || normalizedText.contains("rent"));
    }

    private boolean isConfirmCommand(String normalizedText) {
        return "xac nhan".equals(normalizedText)
                || "xac nhan don".equals(normalizedText)
                || "xac nhan don hang".equals(normalizedText)
                || "ok".equals(normalizedText)
                || "dong y".equals(normalizedText)
                || "chot".equals(normalizedText)
                || "chot don".equals(normalizedText);
    }

    private boolean isCancelCommand(String normalizedText) {
        return "huy".equals(normalizedText)
                || "huy don".equals(normalizedText)
                || "huy don tam".equals(normalizedText)
                || "cancel".equals(normalizedText);
    }

    private boolean shouldTreatAsDraftUpdate(String normalizedText, OrderDraft draft) {
        return draft.getStatus() == com.oms.module.messenger.enums.OrderDraftStatus.NEED_MORE_INFO
                || normalizedText.startsWith("sua")
                || normalizedText.startsWith("cap nhat")
                || normalizedText.startsWith("doi")
                || normalizedText.contains("dia chi")
                || normalizedText.contains("sdt")
                || normalizedText.contains("so dien thoai");
    }

    private String stripUpdatePrefix(String text) {
        int colonIndex = text.indexOf(':');
        if (colonIndex >= 0 && colonIndex < text.length() - 1) {
            return text.substring(colonIndex + 1).trim();
        }
        return text.trim();
    }

    private LocalDateTime parseMessageTime(long timestamp) {
        if (timestamp <= 0) {
            return LocalDateTime.now();
        }
        return LocalDateTime.ofInstant(Instant.ofEpochMilli(timestamp), ZoneId.systemDefault());
    }

    private String textValue(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        return node.asText(null);
    }

    private String normalize(String value) {
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('\u0111', 'd')
                .replace('\u0110', 'D');
        return normalized.toLowerCase().trim().replaceAll("\\s+", " ");
    }

    private record PaymentSelection(
            Order.PaymentMethod paymentMethod,
            Payment.Purpose paymentPurpose,
            String label
    ) {
    }
}

package com.oms.module.messenger.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.module.messenger.dto.MessengerSendResult;
import com.oms.module.messenger.entity.Conversation;
import com.oms.module.messenger.entity.Message;
import com.oms.module.messenger.entity.OrderDraft;
import com.oms.module.messenger.enums.MessageSenderType;
import com.oms.module.messenger.enums.OrderDraftStatus;
import com.oms.module.order.entity.Order;
import com.oms.module.order.service.PublicOrderTrackingTokenService;
import com.oms.module.payment.service.PaymentService;
import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.entity.ShopPaymentConfig;
import com.oms.module.shop.entity.ShopShippingMethod;
import com.oms.module.shop.repository.ShopPaymentConfigRepository;
import com.oms.module.shop.repository.ShopShippingMethodRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MessengerWebhookServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ConversationService conversationService = mock(ConversationService.class);
    private final MessageService messageService = mock(MessageService.class);
    private final OrderDraftService orderDraftService = mock(OrderDraftService.class);
    private final MessengerOrderService messengerOrderService = mock(MessengerOrderService.class);
    private final MessengerSendService messengerSendService = mock(MessengerSendService.class);
    private final MessengerPageResolver messengerPageResolver = mock(MessengerPageResolver.class);
    private final PaymentService paymentService = mock(PaymentService.class);
    private final ShopPaymentConfigRepository paymentConfigRepository = mock(ShopPaymentConfigRepository.class);
    private final ShopShippingMethodRepository shippingMethodRepository = mock(ShopShippingMethodRepository.class);
    private final PublicOrderTrackingTokenService trackingTokenService = mock(PublicOrderTrackingTokenService.class);

    @Test
    void customerConfirmShouldAskShippingBeforePaymentWhenMethodsConfigured() throws Exception {
        MessengerWebhookService service = newService();
        Conversation conversation = conversation();
        Shop shop = shop();
        OrderDraft draft = readyDraft(conversation, shop, Order.OrderType.SELL);
        ShopShippingMethod shippingMethod = shippingMethod(shop);

        when(conversationService.getOrCreateFacebookConversation("page-1", "customer-1"))
                .thenReturn(conversation);
        when(messageService.saveMessage(any(), any(), any(), any(), anyBoolean(), any(), any(), any()))
                .thenReturn(Optional.of(customerMessage(conversation, "xac nhan don")));
        when(orderDraftService.findLatestActiveDraft(10L)).thenReturn(Optional.of(draft));
        when(orderDraftService.findBlockingMissingFields(draft)).thenReturn(List.of());
        when(shippingMethodRepository.findByShopIdAndIsActiveTrue(1L)).thenReturn(List.of(shippingMethod));
        when(messengerSendService.sendSystemMessage(any(), any(), any()))
                .thenReturn(MessengerSendResult.builder().sent(true).build());

        service.processMessagingEvent(customerEvent("xac nhan don", "mid-confirm"), "{}");

        ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
        verify(messengerSendService).sendSystemMessage(eq("page-1"), eq("customer-1"), messageCaptor.capture());
        assertThat(messageCaptor.getValue()).contains("GHN");
        assertThat(messageCaptor.getValue()).contains("\"1\"");
        verify(paymentConfigRepository, never()).findByShopId(any());
    }

    @Test
    void customerShippingSelectionShouldSaveMethodThenAskPayment() throws Exception {
        MessengerWebhookService service = newService();
        Conversation conversation = conversation();
        Shop shop = shop();
        OrderDraft draft = readyDraft(conversation, shop, Order.OrderType.SELL);
        ShopShippingMethod shippingMethod = shippingMethod(shop);
        OrderDraft selectedDraft = readyDraft(conversation, shop, Order.OrderType.SELL);
        selectedDraft.setShippingMethodId(5L);
        selectedDraft.setShippingMethod("GHN");
        selectedDraft.setShippingFee(new BigDecimal("30000"));

        when(conversationService.getOrCreateFacebookConversation("page-1", "customer-1"))
                .thenReturn(conversation);
        when(messageService.saveMessage(any(), any(), any(), any(), anyBoolean(), any(), any(), any()))
                .thenReturn(Optional.of(customerMessage(conversation, "1")));
        when(orderDraftService.findLatestActiveDraft(10L)).thenReturn(Optional.of(draft));
        when(orderDraftService.findBlockingMissingFields(draft)).thenReturn(List.of());
        when(shippingMethodRepository.findByShopIdAndIsActiveTrue(1L)).thenReturn(List.of(shippingMethod));
        when(orderDraftService.applyShippingMethodSelection(draft, shippingMethod)).thenReturn(selectedDraft);
        when(paymentConfigRepository.findByShopId(1L))
                .thenReturn(Optional.of(ShopPaymentConfig.builder().shop(shop).codEnabled(true).build()));
        when(messengerSendService.sendSystemMessage(any(), any(), any()))
                .thenReturn(MessengerSendResult.builder().sent(true).build());

        service.processMessagingEvent(customerEvent("1", "mid-ship"), "{}");

        verify(orderDraftService).applyShippingMethodSelection(draft, shippingMethod);
        ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
        verify(messengerSendService).sendSystemMessage(eq("page-1"), eq("customer-1"), messageCaptor.capture());
        assertThat(messageCaptor.getValue()).contains("COD");
    }

    private MessengerWebhookService newService() {
        return new MessengerWebhookService(
                objectMapper,
                conversationService,
                messageService,
                orderDraftService,
                messengerOrderService,
                messengerSendService,
                messengerPageResolver,
                paymentService,
                paymentConfigRepository,
                shippingMethodRepository,
                trackingTokenService
        );
    }

    private JsonNode customerEvent(String text, String mid) throws Exception {
        return objectMapper.readTree("""
                {
                  "sender": {"id": "customer-1"},
                  "recipient": {"id": "page-1"},
                  "timestamp": 1779050000000,
                  "message": {"mid": "%s", "text": "%s"}
                }
                """.formatted(mid, text));
    }

    private Conversation conversation() {
        Conversation conversation = Conversation.builder()
                .pageId("page-1")
                .senderId("customer-1")
                .conversationKey("facebook:page-1:customer-1")
                .build();
        conversation.setId(10L);
        return conversation;
    }

    private Message customerMessage(Conversation conversation, String text) {
        return Message.builder()
                .conversation(conversation)
                .senderType(MessageSenderType.CUSTOMER)
                .senderId("customer-1")
                .text(text)
                .build();
    }

    private Shop shop() {
        Shop shop = Shop.builder().name("Test shop").build();
        shop.setId(1L);
        return shop;
    }

    private OrderDraft readyDraft(Conversation conversation, Shop shop, Order.OrderType orderType) {
        OrderDraft draft = OrderDraft.builder()
                .shop(shop)
                .conversation(conversation)
                .pageId("page-1")
                .customerPsid("customer-1")
                .status(OrderDraftStatus.PENDING_CUSTOMER_CONFIRMATION)
                .customerName("Nguyen Van A")
                .phone("0395253054")
                .address("123 Ha Noi")
                .productName("Dress")
                .quantity(1)
                .orderType(orderType)
                .totalAmount(new BigDecimal("100000"))
                .build();
        draft.setId(99L);
        return draft;
    }

    private ShopShippingMethod shippingMethod(Shop shop) {
        ShopShippingMethod method = ShopShippingMethod.builder()
                .shop(shop)
                .name("GHN")
                .feePolicy(ShopShippingMethod.FeePolicy.FIXED_FEE)
                .defaultFee(new BigDecimal("30000"))
                .isActive(true)
                .build();
        method.setId(5L);
        return method;
    }
}

package com.oms.module.messenger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.config.MessengerProperties;
import com.oms.module.messenger.entity.OrderDraft;
import com.oms.module.messenger.repository.OrderDraftRepository;
import com.oms.module.order.entity.Order;
import com.oms.module.product.repository.ProductRepository;
import com.oms.module.product.repository.ProductVariantRepository;
import com.oms.module.shop.repository.ShopRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class OrderDraftServiceTest {

    @Test
    void buildConfirmMessageShouldNotShowRentalFieldsForSellOrder() {
        OrderDraftService service = new OrderDraftService(
                mock(OrderDraftRepository.class),
                mock(ConversationService.class),
                mock(MessageService.class),
                mock(OrderExtractionService.class),
                mock(MessengerSendService.class),
                mock(MessengerDtoMapper.class),
                new ObjectMapper(),
                new MessengerProperties(),
                mock(ShopRepository.class),
                mock(ProductRepository.class),
                mock(ProductVariantRepository.class)
        );
        OrderDraft draft = OrderDraft.builder()
                .draftCode("DRAFT-000002")
                .productName("váy cưới áo dài truyền thống việt nam")
                .size("S")
                .color("Đen")
                .quantity(1)
                .orderType(Order.OrderType.SELL)
                .totalAmount(new BigDecimal("1121231"))
                .depositAmount(new BigDecimal("333333"))
                .address("123 hà nội")
                .phone("0395253054")
                .build();

        String message = service.buildConfirmMessage(draft);

        assertThat(message).contains("Loai don: SELL");
        assertThat(message).contains("Tong tien: 1121231");
        assertThat(message).doesNotContain("Thoi gian thue");
        assertThat(message).doesNotContain("Tien coc");
    }
}

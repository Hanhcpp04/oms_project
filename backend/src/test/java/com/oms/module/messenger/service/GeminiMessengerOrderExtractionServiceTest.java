package com.oms.module.messenger.service;

import com.oms.module.messenger.dto.OrderInfoExtractedDto;
import com.oms.module.messenger.entity.Message;
import com.oms.module.messenger.enums.MessageSenderType;
import com.oms.module.order.dto.AiParseRequest;
import com.oms.module.order.dto.AiParseResponse;
import com.oms.module.order.service.OrderAiParseService;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GeminiMessengerOrderExtractionServiceTest {

    @Test
    void shouldNotUseAiDefaultQuantityWhenMessageHasOnlyVariantId() {
        OrderAiParseService aiParseService = mock(OrderAiParseService.class);
        when(aiParseService.parse(any(Long.class), any(AiParseRequest.class))).thenReturn(
                AiParseResponse.builder()
                        .products(List.of(AiParseResponse.ProductDraft.builder()
                                .variantId(8L)
                                .name("Dress")
                                .quantity(1)
                                .build()))
                        .build()
        );
        GeminiMessengerOrderExtractionService service = new GeminiMessengerOrderExtractionService(
                aiParseService,
                new RuleBasedOrderExtractionService()
        );

        OrderInfoExtractedDto result = service.extractOrderInfo(List.of(Message.builder()
                .senderType(MessageSenderType.STAFF)
                .senderId("staff")
                .messageTime(LocalDateTime.now())
                .text("""
                        Tạo đơn Messenger từ OMS:
                        - Variant ID: 8
                        """)
                .build()), 1L);

        assertThat(result.getVariantId()).isEqualTo(8L);
        assertThat(result.getQuantity())
                .as("AI default quantity must not satisfy Messenger quantity")
                .isNull();
        assertThat(result.getMissingFields()).contains("quantity");
    }

    @Test
    void shouldIgnoreAiFieldLikeCustomerNameAndRentalDateAddress() {
        OrderAiParseService aiParseService = mock(OrderAiParseService.class);
        when(aiParseService.parse(any(Long.class), any(AiParseRequest.class))).thenReturn(
                AiParseResponse.builder()
                        .orderType(com.oms.module.order.entity.Order.OrderType.RENT)
                        .customerName("số lượng")
                        .customerAddress("1 ngày thuê là 2026-05-19 đến 2026-05-22")
                        .rentFrom("2026-05-19")
                        .rentTo("2026-05-22")
                        .build()
        );
        GeminiMessengerOrderExtractionService service = new GeminiMessengerOrderExtractionService(
                aiParseService,
                new RuleBasedOrderExtractionService()
        );

        OrderInfoExtractedDto result = service.extractOrderInfo(List.of(Message.builder()
                .senderType(MessageSenderType.CUSTOMER)
                .senderId("customer")
                .messageTime(LocalDateTime.now())
                .text("số lượng 1 ngày thuê là 2026-05-19 đến 2026-05-22")
                .build()), 1L);

        assertThat(result.getQuantity()).isEqualTo(1);
        assertThat(result.getCustomerName()).isNull();
        assertThat(result.getAddress()).isNull();
        assertThat(result.getRentFrom()).isEqualTo(LocalDate.of(2026, 5, 19));
        assertThat(result.getRentTo()).isEqualTo(LocalDate.of(2026, 5, 22));
        assertThat(result.getRentalDays()).isEqualTo(4);
    }
}

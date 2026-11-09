package com.oms.module.messenger.service;

import com.oms.module.messenger.entity.Conversation;
import com.oms.module.messenger.entity.MessengerOrder;
import com.oms.module.messenger.entity.OrderDraft;
import com.oms.module.messenger.entity.OrderDraftItem;
import com.oms.module.messenger.enums.OrderDraftStatus;
import com.oms.module.messenger.event.OrderCreatedFromMessengerEvent;
import com.oms.module.messenger.repository.MessengerOrderRepository;
import com.oms.module.messenger.repository.OrderDraftRepository;
import com.oms.module.order.dto.OrderRequest;
import com.oms.module.order.entity.Order;
import com.oms.module.order.repository.OrderRepository;
import com.oms.module.order.service.OrderService;
import com.oms.module.product.entity.Product;
import com.oms.module.product.entity.ProductType;
import com.oms.module.product.entity.ProductVariant;
import com.oms.module.product.repository.ProductVariantRepository;
import com.oms.module.shop.entity.Shop;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MessengerOrderServiceTest {

    @Test
    void confirmDraftManuallyShouldNotTreatConfiguredDepositAsPaid() {
        MessengerOrderRepository messengerOrderRepository = mock(MessengerOrderRepository.class);
        OrderDraftRepository orderDraftRepository = mock(OrderDraftRepository.class);
        OrderRepository orderRepository = mock(OrderRepository.class);
        OrderDraftService orderDraftService = mock(OrderDraftService.class);
        OrderService orderService = mock(OrderService.class);
        ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
        ProductVariantRepository productVariantRepository = mock(ProductVariantRepository.class);
        MessengerOrderService service = new MessengerOrderService(
                messengerOrderRepository,
                orderDraftRepository,
                orderRepository,
                orderDraftService,
                orderService,
                eventPublisher,
                productVariantRepository
        );

        Shop shop = Shop.builder().name("Test shop").build();
        shop.setId(1L);
        Product product = Product.builder()
                .shop(shop)
                .name("Dress")
                .productType(ProductType.RENT)
                .isActive(true)
                .build();
        ProductVariant variant = ProductVariant.builder()
                .product(product)
                .stockQty(2)
                .priceRentPerDay(new BigDecimal("100000"))
                .depositAmount(new BigDecimal("500000"))
                .isActive(true)
                .build();
        variant.setId(8L);
        Conversation conversation = Conversation.builder()
                .pageId("page-1")
                .senderId("customer-1")
                .conversationKey("facebook:page-1:customer-1")
                .build();
        conversation.setId(10L);
        OrderDraft draft = OrderDraft.builder()
                .shop(shop)
                .conversation(conversation)
                .pageId("page-1")
                .customerPsid("customer-1")
                .status(OrderDraftStatus.PENDING_CUSTOMER_CONFIRMATION)
                .customerName("Nguyen Van A")
                .phone("0395253054")
                .address("123 Ha Noi")
                .shippingMethodId(5L)
                .shippingMethod("GHN")
                .shippingFee(new BigDecimal("30000"))
                .productName("Dress")
                .quantity(1)
                .orderType(Order.OrderType.RENT)
                .depositAmount(new BigDecimal("500000"))
                .rentFrom(LocalDate.of(2026, 5, 20))
                .rentTo(LocalDate.of(2026, 5, 22))
                .build();
        draft.setId(99L);
        draft.addItem(OrderDraftItem.builder()
                .product(product)
                .productVariant(variant)
                .productName("Dress")
                .quantity(1)
                .price(new BigDecimal("100000"))
                .deposit(new BigDecimal("500000"))
                .build());
        Order createdOrder = Order.builder()
                .shop(shop)
                .orderType(Order.OrderType.RENT)
                .status(Order.OrderStatus.PENDING)
                .paymentStatus(Order.PaymentStatus.UNPAID)
                .depositAmount(BigDecimal.ZERO)
                .build();

        when(orderDraftRepository.findByIdAndShopIdForUpdate(99L, 1L)).thenReturn(Optional.of(draft));
        when(orderDraftService.isExpired(draft)).thenReturn(false);
        when(orderDraftService.findBlockingMissingFields(draft)).thenReturn(List.of());
        when(orderService.createOrderEntity(eq(1L), any(OrderRequest.class), isNull())).thenReturn(createdOrder);
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderDraftRepository.save(any(OrderDraft.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(messengerOrderRepository.findByOrderDraftId(99L))
                .thenReturn(Optional.of(MessengerOrder.builder().build()));

        Order savedOrder = service.confirmDraftManually(1L, 99L);

        ArgumentCaptor<OrderRequest> requestCaptor = ArgumentCaptor.forClass(OrderRequest.class);
        verify(orderService).createOrderEntity(eq(1L), requestCaptor.capture(), isNull());
        assertThat(requestCaptor.getValue().getDepositPaid()).isEqualByComparingTo("0");
        assertThat(requestCaptor.getValue().getShippingMethodId()).isEqualTo(5L);
        assertThat(requestCaptor.getValue().getShippingMethod()).isEqualTo("GHN");
        assertThat(requestCaptor.getValue().getShippingFee()).isEqualByComparingTo("30000");
        assertThat(savedOrder.getDepositAmount()).isEqualByComparingTo("0");
        assertThat(savedOrder.getPaymentStatus()).isEqualTo(Order.PaymentStatus.UNPAID);
        verify(eventPublisher).publishEvent(any(OrderCreatedFromMessengerEvent.class));
    }
}

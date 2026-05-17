package com.oms.module.messenger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.common.exception.BusinessException;
import com.oms.config.MessengerProperties;
import com.oms.module.messenger.dto.MessengerSendResult;
import com.oms.module.messenger.dto.OrderInfoExtractedDto;
import com.oms.module.messenger.entity.Conversation;
import com.oms.module.messenger.entity.Message;
import com.oms.module.messenger.entity.OrderDraft;
import com.oms.module.messenger.entity.OrderDraftItem;
import com.oms.module.messenger.enums.MessageSenderType;
import com.oms.module.messenger.enums.OrderDraftStatus;
import com.oms.module.messenger.repository.OrderDraftRepository;
import com.oms.module.order.entity.Order;
import com.oms.module.product.entity.Product;
import com.oms.module.product.entity.ProductType;
import com.oms.module.product.entity.ProductVariant;
import com.oms.module.product.repository.ProductRepository;
import com.oms.module.product.repository.ProductVariantRepository;
import com.oms.module.rental.entity.RentalAvailability;
import com.oms.module.rental.repository.RentalAvailabilityRepository;
import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.repository.ShopRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderDraftServiceTest {

    @Test
    void buildConfirmMessageShouldNotShowRentalFieldsForSellOrder() {
        OrderDraftService service = newService();
        OrderDraft draft = OrderDraft.builder()
                .draftCode("DRAFT-000002")
                .productName("váy cưới áo dài truyền thống việt nam")
                .size("S")
                .color("Đen")
                .quantity(1)
                .orderType(Order.OrderType.SELL)
                .customerName("Nguyen Van A")
                .totalAmount(new BigDecimal("1121231"))
                .depositAmount(new BigDecimal("333333"))
                .address("123 hà nội")
                .phone("0395253054")
                .build();

        String message = service.buildConfirmMessage(draft);

        assertThat(message).contains("Khách hàng: Nguyen Van A");
        assertThat(message).contains("Số lượng: 1");
        assertThat(message).contains("Loại đơn: SELL");
        assertThat(message).contains("Tổng tiền: 1121231");
        assertThat(message).doesNotContain("Thời gian thuê");
        assertThat(message).doesNotContain("Tiền cọc");
        assertThat(message.split("Xác nhận đơn", -1)).hasSize(2);
    }

    @Test
    void buildConfirmMessageShouldAskForMissingCustomerNameOnce() {
        OrderDraftService service = newService();
        OrderDraft draft = OrderDraft.builder()
                .draftCode("DRAFT-000003")
                .productName("Dress")
                .quantity(1)
                .orderType(Order.OrderType.SELL)
                .totalAmount(new BigDecimal("100000"))
                .address("123 Ha Noi")
                .phone("0395253054")
                .build();

        String message = service.buildConfirmMessage(draft);

        assertThat(message).contains("- Họ và tên người nhận");
        assertThat(message.split("Họ và tên người nhận", -1)).hasSize(2);
        assertThat(message).doesNotContain("- customerName");
    }

    @Test
    void applyCustomerUpdateShouldCalculateRentalSubtotalForEveryRentalDay() {
        OrderDraftRepository orderDraftRepository = mock(OrderDraftRepository.class);
        OrderExtractionService orderExtractionService = mock(OrderExtractionService.class);
        MessengerSendService messengerSendService = mock(MessengerSendService.class);
        OrderDraftService service = newService(
                orderDraftRepository,
                orderExtractionService,
                messengerSendService,
                mock(RentalAvailabilityRepository.class)
        );
        Conversation conversation = Conversation.builder()
                .pageId("page-1")
                .senderId("customer-1")
                .conversationKey("facebook:page-1:customer-1")
                .build();
        conversation.setId(10L);
        OrderDraft draft = OrderDraft.builder()
                .conversation(conversation)
                .pageId("page-1")
                .customerPsid("customer-1")
                .status(OrderDraftStatus.PENDING_CUSTOMER_CONFIRMATION)
                .draftCode("DRAFT-000004")
                .customerName("Nguyen Van A")
                .phone("0395253054")
                .address("123 Ha Noi")
                .productName("Dress")
                .quantity(2)
                .orderType(Order.OrderType.RENT)
                .price(new BigDecimal("100000"))
                .rentFrom(LocalDate.of(2026, 5, 20))
                .rentTo(LocalDate.of(2026, 5, 22))
                .build();
        draft.addItem(OrderDraftItem.builder()
                .productName("Dress")
                .quantity(2)
                .price(new BigDecimal("100000"))
                .build());

        when(orderDraftRepository.findTopByConversationIdAndStatusInOrderByCreatedAtDesc(eq(10L), any()))
                .thenReturn(Optional.of(draft));
        when(orderExtractionService.extractOrderInfo(any(), eq(null)))
                .thenReturn(OrderInfoExtractedDto.builder().build());
        when(orderDraftRepository.save(any(OrderDraft.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Optional<OrderDraft> updated = service.applyCustomerUpdate(conversation, "giu nguyen don");

        assertThat(updated).isPresent();
        assertThat(updated.get().getRentalDays()).isEqualTo(3);
        assertThat(updated.get().getSubtotal()).isEqualByComparingTo("600000");
        assertThat(updated.get().getTotalAmount()).isEqualByComparingTo("600000");
        assertThat(updated.get().getItems().get(0).getRentalDays()).isEqualTo(3);
    }

    @Test
    void validateDraftCanCreateOrderShouldRequireDraftQuantityEvenWhenItemHasDefaultQuantity() {
        OrderDraftService service = newService();
        Shop shop = Shop.builder().name("Test shop").build();
        shop.setId(1L);
        Product product = Product.builder()
                .shop(shop)
                .name("Dress")
                .productType(ProductType.SELL)
                .isActive(true)
                .build();
        ProductVariant variant = ProductVariant.builder()
                .product(product)
                .stockQty(5)
                .priceSell(new BigDecimal("100000"))
                .isActive(true)
                .build();
        OrderDraft draft = OrderDraft.builder()
                .shop(shop)
                .customerName("Nguyen Van A")
                .phone("0395253054")
                .address("123 Ha Noi")
                .productName("Dress")
                .orderType(Order.OrderType.SELL)
                .build();
        draft.addItem(OrderDraftItem.builder()
                .product(product)
                .productVariant(variant)
                .productName("Dress")
                .quantity(1)
                .price(new BigDecimal("100000"))
                .build());

        assertThatThrownBy(() -> service.validateDraftCanCreateOrder(draft))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void applyCustomerUpdateShouldTreatStandaloneNumberAsMissingQuantity() {
        OrderDraftRepository orderDraftRepository = mock(OrderDraftRepository.class);
        OrderExtractionService orderExtractionService = mock(OrderExtractionService.class);
        MessengerSendService messengerSendService = mock(MessengerSendService.class);
        OrderDraftService service = newService(
                orderDraftRepository,
                orderExtractionService,
                messengerSendService,
                mock(RentalAvailabilityRepository.class)
        );
        Conversation conversation = Conversation.builder()
                .pageId("page-1")
                .senderId("customer-1")
                .conversationKey("facebook:page-1:customer-1")
                .build();
        conversation.setId(10L);
        OrderDraft draft = OrderDraft.builder()
                .conversation(conversation)
                .pageId("page-1")
                .customerPsid("customer-1")
                .status(OrderDraftStatus.NEED_MORE_INFO)
                .draftCode("DRAFT-000004")
                .customerName("Nguyen Van A")
                .phone("0377789567")
                .address("1234 ha noi")
                .productName("Dress")
                .orderType(Order.OrderType.SELL)
                .price(new BigDecimal("1121231"))
                .build();

        when(orderDraftRepository.findTopByConversationIdAndStatusInOrderByCreatedAtDesc(eq(10L), any()))
                .thenReturn(Optional.of(draft));
        when(orderExtractionService.extractOrderInfo(any(), eq(null)))
                .thenReturn(OrderInfoExtractedDto.builder().build());
        when(orderDraftRepository.save(any(OrderDraft.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Optional<OrderDraft> updated = service.applyCustomerUpdate(conversation, "1");

        assertThat(updated).isPresent();
        assertThat(updated.get().getQuantity()).isEqualTo(1);
        assertThat(updated.get().getStatus()).isEqualTo(OrderDraftStatus.PENDING_CUSTOMER_CONFIRMATION);
        assertThat(updated.get().getConfirmMessage()).contains("Số lượng: 1");
    }

    @Test
    void applyCustomerUpdateShouldExtractUnlabeledNameAddressAndPhone() {
        OrderDraftRepository orderDraftRepository = mock(OrderDraftRepository.class);
        OrderExtractionService orderExtractionService = mock(OrderExtractionService.class);
        MessengerSendService messengerSendService = mock(MessengerSendService.class);
        OrderDraftService service = newService(
                orderDraftRepository,
                orderExtractionService,
                messengerSendService,
                mock(RentalAvailabilityRepository.class)
        );
        Conversation conversation = Conversation.builder()
                .pageId("page-1")
                .senderId("customer-1")
                .conversationKey("facebook:page-1:customer-1")
                .build();
        conversation.setId(10L);
        OrderDraft draft = OrderDraft.builder()
                .conversation(conversation)
                .pageId("page-1")
                .customerPsid("customer-1")
                .status(OrderDraftStatus.NEED_MORE_INFO)
                .draftCode("DRAFT-000004")
                .phone(null)
                .productName("Dress")
                .quantity(1)
                .orderType(Order.OrderType.SELL)
                .price(new BigDecimal("1121231"))
                .build();

        when(orderDraftRepository.findTopByConversationIdAndStatusInOrderByCreatedAtDesc(eq(10L), any()))
                .thenReturn(Optional.of(draft));
        when(orderExtractionService.extractOrderInfo(any(), eq(null)))
                .thenReturn(OrderInfoExtractedDto.builder()
                        .phone("0395253054")
                        .build());
        when(orderDraftRepository.save(any(OrderDraft.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Optional<OrderDraft> updated = service.applyCustomerUpdate(
                conversation,
                "hà hoàng anh 123 quang trung hà nội 0395253054 đây ạ");

        assertThat(updated).isPresent();
        assertThat(updated.get().getCustomerName()).isEqualTo("hà hoàng anh");
        assertThat(updated.get().getAddress()).isEqualTo("123 quang trung hà nội");
        assertThat(updated.get().getPhone()).isEqualTo("0395253054");
        assertThat(updated.get().getStatus()).isEqualTo(OrderDraftStatus.PENDING_CUSTOMER_CONFIRMATION);
    }

    @Test
    void applyCustomerUpdateShouldStripExplicitAddressCommand() {
        OrderDraftRepository orderDraftRepository = mock(OrderDraftRepository.class);
        OrderExtractionService orderExtractionService = mock(OrderExtractionService.class);
        MessengerSendService messengerSendService = mock(MessengerSendService.class);
        OrderDraftService service = newService(
                orderDraftRepository,
                orderExtractionService,
                messengerSendService,
                mock(RentalAvailabilityRepository.class)
        );
        Conversation conversation = Conversation.builder()
                .pageId("page-1")
                .senderId("customer-1")
                .conversationKey("facebook:page-1:customer-1")
                .build();
        conversation.setId(10L);
        OrderDraft draft = OrderDraft.builder()
                .conversation(conversation)
                .pageId("page-1")
                .customerPsid("customer-1")
                .status(OrderDraftStatus.PENDING_CUSTOMER_CONFIRMATION)
                .draftCode("DRAFT-000007")
                .customerName("hà hoàng anh")
                .phone("0395253054")
                .address("123 quang trung hà nội")
                .productName("Dress")
                .quantity(1)
                .orderType(Order.OrderType.RENT)
                .rentFrom(LocalDate.of(2026, 5, 18))
                .rentTo(LocalDate.of(2026, 5, 20))
                .rentalDays(3)
                .price(new BigDecimal("112"))
                .build();

        when(orderDraftRepository.findTopByConversationIdAndStatusInOrderByCreatedAtDesc(eq(10L), any()))
                .thenReturn(Optional.of(draft));
        when(orderExtractionService.extractOrderInfo(any(), eq(null)))
                .thenReturn(OrderInfoExtractedDto.builder()
                        .address("sửa địa chỉ thành 12 quang trung hà nội")
                        .build());
        when(orderDraftRepository.save(any(OrderDraft.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Optional<OrderDraft> updated = service.applyCustomerUpdate(
                conversation,
                "sửa địa chỉ thành 12 quang trung hà nội");

        assertThat(updated).isPresent();
        assertThat(updated.get().getAddress()).isEqualTo("12 quang trung hà nội");
        assertThat(updated.get().getConfirmMessage()).contains("Địa chỉ giao hàng: 12 quang trung hà nội");
        assertThat(updated.get().getConfirmMessage()).doesNotContain("sửa địa chỉ thành");
    }

    @Test
    void validateDraftCanCreateOrderShouldReturnPublicRentalFormLinkWhenRentDatesAreUnavailable() {
        RentalAvailabilityRepository availabilityRepository = mock(RentalAvailabilityRepository.class);
        OrderDraftService service = newService(
                mock(OrderDraftRepository.class),
                mock(OrderExtractionService.class),
                mock(MessengerSendService.class),
                availabilityRepository
        );
        Shop shop = Shop.builder()
                .name("Test shop")
                .slug("test-shop")
                .build();
        shop.setId(1L);
        Product product = Product.builder()
                .shop(shop)
                .name("Dress")
                .productType(ProductType.RENT)
                .isActive(true)
                .build();
        product.setId(12L);
        ProductVariant variant = ProductVariant.builder()
                .product(product)
                .stockQty(1)
                .priceRentPerDay(new BigDecimal("100000"))
                .isActive(true)
                .build();
        variant.setId(8L);
        LocalDate rentFrom = LocalDate.of(2026, 5, 20);
        LocalDate rentTo = LocalDate.of(2026, 5, 22);
        when(availabilityRepository.findConflicts(8L, rentFrom, rentTo))
                .thenReturn(List.of(RentalAvailability.builder()
                        .variant(variant)
                        .startDate(rentFrom)
                        .endDate(rentTo)
                        .isActive(true)
                        .build()));
        OrderDraft draft = OrderDraft.builder()
                .shop(shop)
                .customerName("Nguyen Van A")
                .phone("0395253054")
                .address("123 Ha Noi")
                .productName("Dress")
                .quantity(1)
                .orderType(Order.OrderType.RENT)
                .rentFrom(rentFrom)
                .rentTo(rentTo)
                .build();
        draft.addItem(OrderDraftItem.builder()
                .product(product)
                .productVariant(variant)
                .productName("Dress")
                .quantity(1)
                .price(new BigDecimal("100000"))
                .build());

        assertThatThrownBy(() -> service.validateDraftCanCreateOrder(draft))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("không còn đủ lịch trống")
                .hasMessageContaining("http://localhost:4200/f/test-shop?p=12&v=8&orderType=RENT");
    }

    @Test
    void checkRentalAvailabilityFromSellerMessageShouldNotCreateDraft() {
        OrderDraftRepository orderDraftRepository = mock(OrderDraftRepository.class);
        MessageService messageService = mock(MessageService.class);
        MessengerSendService messengerSendService = mock(MessengerSendService.class);
        ProductVariantRepository productVariantRepository = mock(ProductVariantRepository.class);
        RentalAvailabilityRepository availabilityRepository = mock(RentalAvailabilityRepository.class);
        OrderDraftService service = newService(
                orderDraftRepository,
                messageService,
                new RuleBasedOrderExtractionService(),
                messengerSendService,
                mock(ProductRepository.class),
                productVariantRepository,
                availabilityRepository
        );
        Shop shop = Shop.builder()
                .name("Test shop")
                .slug("test-shop")
                .build();
        shop.setId(1L);
        Product product = Product.builder()
                .shop(shop)
                .name("Dress")
                .productType(ProductType.RENT)
                .isActive(true)
                .build();
        product.setId(12L);
        ProductVariant variant = ProductVariant.builder()
                .product(product)
                .size("S")
                .color("Đen")
                .stockQty(2)
                .priceRentPerDay(new BigDecimal("100000"))
                .isActive(true)
                .build();
        variant.setId(1L);
        Conversation conversation = Conversation.builder()
                .pageId("page-1")
                .senderId("customer-1")
                .conversationKey("facebook:page-1:customer-1")
                .build();
        conversation.setId(10L);
        Message customerMessage = Message.builder()
                .senderType(MessageSenderType.CUSTOMER)
                .senderId("customer-1")
                .text("minh muon thue 1 cai tu 2026-05-20 trong 3 ngay")
                .messageTime(LocalDateTime.now().minusMinutes(1))
                .build();
        customerMessage.setId(100L);
        Message staffMessage = Message.builder()
                .senderType(MessageSenderType.STAFF)
                .senderId("staff-1")
                .mid("mid-check-1")
                .text("san pham ban dang muon thue co ma la Variant ID: 1 a ban cho chut he thong kiem tra a")
                .messageTime(LocalDateTime.now())
                .build();
        staffMessage.setId(101L);

        when(messageService.getDraftContextMessages(conversation, 200))
                .thenReturn(List.of(customerMessage, staffMessage));
        when(productVariantRepository.findByIdAndProductShopId(1L, 1L))
                .thenReturn(Optional.of(variant));
        when(availabilityRepository.findConflicts(1L, LocalDate.of(2026, 5, 20), LocalDate.of(2026, 5, 22)))
                .thenReturn(List.of());
        when(messengerSendService.sendSystemMessage(eq("page-1"), eq("customer-1"), any()))
                .thenReturn(MessengerSendResult.builder().sent(true).build());

        Optional<String> result = service.checkRentalAvailabilityFromSellerMessage(conversation, staffMessage, shop);

        assertThat(result).isPresent();
        assertThat(result.get()).contains("còn lịch trống");
        assertThat(result.get()).contains("2026-05-20 đến 2026-05-22");
        verify(orderDraftRepository, never()).save(any());
        verify(messengerSendService).sendSystemMessage(eq("page-1"), eq("customer-1"), any());
    }

    @Test
    void checkRentalAvailabilityFromCustomerReplyShouldContinuePendingCheckWithoutCreatingDraft() {
        OrderDraftRepository orderDraftRepository = mock(OrderDraftRepository.class);
        MessageService messageService = mock(MessageService.class);
        MessengerSendService messengerSendService = mock(MessengerSendService.class);
        ProductVariantRepository productVariantRepository = mock(ProductVariantRepository.class);
        RentalAvailabilityRepository availabilityRepository = mock(RentalAvailabilityRepository.class);
        OrderDraftService service = newService(
                orderDraftRepository,
                messageService,
                new RuleBasedOrderExtractionService(),
                messengerSendService,
                mock(ProductRepository.class),
                productVariantRepository,
                availabilityRepository
        );
        Shop shop = Shop.builder()
                .name("Test shop")
                .slug("test-shop")
                .build();
        shop.setId(1L);
        Product product = Product.builder()
                .shop(shop)
                .name("Dress")
                .productType(ProductType.RENT)
                .isActive(true)
                .build();
        product.setId(12L);
        ProductVariant variant = ProductVariant.builder()
                .product(product)
                .size("S")
                .color("Đen")
                .stockQty(2)
                .priceRentPerDay(new BigDecimal("100000"))
                .isActive(true)
                .build();
        variant.setId(1L);
        Conversation conversation = Conversation.builder()
                .pageId("page-1")
                .senderId("customer-1")
                .conversationKey("facebook:page-1:customer-1")
                .build();
        conversation.setId(10L);
        Message staffMessage = Message.builder()
                .senderType(MessageSenderType.STAFF)
                .senderId("staff-1")
                .mid("mid-check-1")
                .text("san pham ban dang muon thue co ma la Variant ID: 1 a ban cho chut he thong kiem tra a")
                .messageTime(LocalDateTime.now().minusMinutes(1))
                .build();
        staffMessage.setId(100L);
        Message customerReply = Message.builder()
                .senderType(MessageSenderType.CUSTOMER)
                .senderId("customer-1")
                .text("mình muốn thuê một chiếc ạ từ ngày 18/5 đến ngày 20/5 có trống lịch không ạ")
                .messageTime(LocalDateTime.now())
                .build();
        customerReply.setId(101L);
        LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
        LocalDate rentFrom = LocalDate.of(today.getYear(), 5, 18);
        LocalDate rentTo = LocalDate.of(today.getYear(), 5, 20);
        if (rentFrom.isBefore(today.minusDays(1))) {
            rentFrom = rentFrom.plusYears(1);
            rentTo = rentTo.plusYears(1);
        }

        when(messageService.getDraftContextMessages(conversation, 200))
                .thenReturn(List.of(staffMessage));
        when(productVariantRepository.findByIdAndProductShopId(1L, 1L))
                .thenReturn(Optional.of(variant));
        when(availabilityRepository.findConflicts(1L, rentFrom, rentTo))
                .thenReturn(List.of());
        when(messengerSendService.sendSystemMessage(eq("page-1"), eq("customer-1"), any()))
                .thenReturn(MessengerSendResult.builder().sent(true).build());

        Optional<String> result = service.checkRentalAvailabilityFromCustomerMessage(conversation, customerReply, shop);

        assertThat(result).isPresent();
        assertThat(result.get()).contains("còn lịch trống");
        assertThat(result.get()).contains(rentFrom + " đến " + rentTo);
        verify(orderDraftRepository, never()).save(any());
        verify(messengerSendService).sendSystemMessage(eq("page-1"), eq("customer-1"), any());
    }

    private OrderDraftService newService() {
        return newService(
                mock(OrderDraftRepository.class),
                mock(OrderExtractionService.class),
                mock(MessengerSendService.class),
                mock(RentalAvailabilityRepository.class)
        );
    }

    private OrderDraftService newService(
            OrderDraftRepository orderDraftRepository,
            OrderExtractionService orderExtractionService,
            MessengerSendService messengerSendService,
            RentalAvailabilityRepository availabilityRepository
    ) {
        return new OrderDraftService(
                orderDraftRepository,
                mock(ConversationService.class),
                mock(MessageService.class),
                orderExtractionService,
                messengerSendService,
                mock(MessengerDtoMapper.class),
                new ObjectMapper(),
                new MessengerProperties(),
                mock(ShopRepository.class),
                mock(ProductRepository.class),
                mock(ProductVariantRepository.class),
                availabilityRepository
        );
    }

    private OrderDraftService newService(
            OrderDraftRepository orderDraftRepository,
            MessageService messageService,
            OrderExtractionService orderExtractionService,
            MessengerSendService messengerSendService,
            ProductRepository productRepository,
            ProductVariantRepository productVariantRepository,
            RentalAvailabilityRepository availabilityRepository
    ) {
        return new OrderDraftService(
                orderDraftRepository,
                mock(ConversationService.class),
                messageService,
                orderExtractionService,
                messengerSendService,
                mock(MessengerDtoMapper.class),
                new ObjectMapper(),
                new MessengerProperties(),
                mock(ShopRepository.class),
                productRepository,
                productVariantRepository,
                availabilityRepository
        );
    }
}

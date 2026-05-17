package com.oms.module.messenger.service;

import com.oms.module.messenger.dto.OrderInfoExtractedDto;
import com.oms.module.messenger.entity.Message;
import com.oms.module.messenger.enums.MessageSenderType;
import com.oms.module.order.entity.Order;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RuleBasedOrderExtractionServiceTest {

    private final RuleBasedOrderExtractionService service = new RuleBasedOrderExtractionService();

    @Test
    void shouldExtractOmsCopiedRentProductBlock() {
        Message message = Message.builder()
                .senderType(MessageSenderType.STAFF)
                .senderId("staff")
                .messageTime(LocalDateTime.now())
                .text("""
                        Tạo đơn Messenger từ OMS:
                        - Product ID: 12
                        - Variant ID: 34
                        - Mã sản phẩm: DRESS-01
                        - Tên sản phẩm: Váy dự tiệc
                        - SKU: DRESS-01-BLACK-M
                        - Size: M
                        - Màu: Đen
                        - Số lượng: 2
                        - Loại đơn: RENT
                        - Giá thuê: 150000
                        - Tiền cọc: 500000
                        - Số ngày thuê: 3
                        - Ngày nhận: 2026-05-20
                        - Ngày trả: 2026-05-22
                        """)
                .build();

        OrderInfoExtractedDto result = service.extractOrderInfo(List.of(message), 1L);

        assertThat(result.getOrderType()).isEqualTo(Order.OrderType.RENT);
        assertThat(result.getProductId()).isEqualTo(12L);
        assertThat(result.getVariantId()).isEqualTo(34L);
        assertThat(result.getProductCode()).isEqualTo("DRESS-01");
        assertThat(result.getSku()).isEqualTo("DRESS-01-BLACK-M");
        assertThat(result.getQuantity()).isEqualTo(2);
        assertThat(result.getRentalDays()).isEqualTo(3);
        assertThat(result.getRentFrom()).isEqualTo(LocalDate.of(2026, 5, 20));
        assertThat(result.getRentTo()).isEqualTo(LocalDate.of(2026, 5, 22));
        assertThat(result.getPrice()).isEqualByComparingTo(new BigDecimal("150000"));
        assertThat(result.getDepositAmount()).isEqualByComparingTo(new BigDecimal("500000"));
        assertThat(result.getItems()).hasSize(1);
        assertThat(result.getItems().get(0).getVariantId()).isEqualTo(34L);
    }

    @Test
    void shouldDeriveRentalDaysFromCopiedDateRange() {
        Message message = Message.builder()
                .senderType(MessageSenderType.STAFF)
                .senderId("staff")
                .messageTime(LocalDateTime.now())
                .text("""
                        Tạo đơn Messenger từ OMS:
                        - Product ID: 12
                        - Variant ID: 34
                        - Tên sản phẩm: Váy dự tiệc
                        - SKU: DRESS-01-BLACK-M
                        - Số lượng: 1
                        - Loại đơn: RENT
                        - Ngày nhận: 2026-05-20
                        - Ngày trả: 2026-05-22
                        """)
                .build();

        OrderInfoExtractedDto result = service.extractOrderInfo(List.of(message), 1L);

        assertThat(result.getRentalDays()).isEqualTo(3);
        assertThat(result.getRentFrom()).isEqualTo(LocalDate.of(2026, 5, 20));
        assertThat(result.getRentTo()).isEqualTo(LocalDate.of(2026, 5, 22));
    }

    @Test
    void shouldUseLatestCopiedProductBlockWhenContextContainsPreviousBlock() {
        Message oldMessage = Message.builder()
                .senderType(MessageSenderType.STAFF)
                .senderId("staff")
                .messageTime(LocalDateTime.now().minusMinutes(1))
                .text("""
                        Tạo đơn Messenger từ OMS:
                        - Product ID: 7
                        - Variant ID: 2
                        - Tên sản phẩm: test
                        - Số lượng: 1
                        - Loại đơn: SELL
                        - Đơn giá: 333333
                        """)
                .build();
        Message latestMessage = Message.builder()
                .senderType(MessageSenderType.STAFF)
                .senderId("staff")
                .messageTime(LocalDateTime.now())
                .text("""
                        Tạo đơn Messenger từ OMS:
                        - Product ID: 12
                        - Variant ID: 8
                        - Tên sản phẩm: váy cưới áo dài truyền thống việt nam
                        - Size: S
                        - Màu: Đen
                        - Số lượng: 1
                        - Loại đơn: SELL
                        - Đơn giá: 1121231
                        """)
                .build();

        OrderInfoExtractedDto result = service.extractOrderInfo(List.of(oldMessage, latestMessage), 1L);

        assertThat(result.getProductId()).isEqualTo(12L);
        assertThat(result.getVariantId()).isEqualTo(8L);
        assertThat(result.getProductName()).isEqualTo("váy cưới áo dài truyền thống việt nam");
        assertThat(result.getPrice()).isEqualByComparingTo(new BigDecimal("1121231"));
    }

    @Test
    void shouldExtractMinimalOmsCopiedVariantBlock() {
        Message message = Message.builder()
                .senderType(MessageSenderType.STAFF)
                .senderId("staff")
                .messageTime(LocalDateTime.now())
                .text("""
                        Tạo đơn Messenger từ OMS:
                        - Variant ID: 8
                        """)
                .build();

        OrderInfoExtractedDto result = service.extractOrderInfo(List.of(message), 1L);

        assertThat(result.getVariantId()).isEqualTo(8L);
        assertThat(result.getProductId()).isNull();
        assertThat(result.getQuantity()).isNull();
        assertThat(result.getOrderType()).isNull();
    }

    @Test
    void shouldExtractInlineRentalVariantCheckMessage() {
        Message message = Message.builder()
                .senderType(MessageSenderType.STAFF)
                .senderId("staff")
                .messageTime(LocalDateTime.now())
                .text("san pham ban dang muon thue co ma la Variant ID: 1 a ban cho chut he thong kiem tra a")
                .build();

        OrderInfoExtractedDto result = service.extractOrderInfo(List.of(message), 1L);

        assertThat(result.getOrderType()).isEqualTo(Order.OrderType.RENT);
        assertThat(result.getVariantId()).isEqualTo(1L);
        assertThat(result.getQuantity()).isNull();
    }

    @Test
    void shouldExtractRentalQuantityWordAndDateRangeWithoutYear() {
        Message message = Message.builder()
                .senderType(MessageSenderType.CUSTOMER)
                .senderId("customer")
                .messageTime(LocalDateTime.now())
                .text("mình muốn thuê một chiếc ạ từ ngày 18/5 đến ngày 20/5 có trống lịch không ạ")
                .build();

        OrderInfoExtractedDto result = service.extractOrderInfo(List.of(message), 1L);
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        LocalDate expectedFrom = LocalDate.of(today.getYear(), 5, 18);
        LocalDate expectedTo = LocalDate.of(today.getYear(), 5, 20);
        if (expectedFrom.isBefore(today.minusDays(1))) {
            expectedFrom = expectedFrom.plusYears(1);
            expectedTo = expectedTo.plusYears(1);
        }

        assertThat(result.getOrderType()).isEqualTo(Order.OrderType.RENT);
        assertThat(result.getQuantity()).isEqualTo(1);
        assertThat(result.getRentFrom()).isEqualTo(expectedFrom);
        assertThat(result.getRentTo()).isEqualTo(expectedTo);
        assertThat(result.getRentalDays()).isEqualTo(3);
    }

    @Test
    void shouldNotTreatQuantityBeforeRentalDateAsRentalDays() {
        Message message = Message.builder()
                .senderType(MessageSenderType.CUSTOMER)
                .senderId("customer")
                .messageTime(LocalDateTime.now())
                .text("số lượng 1 ngày thuê là 19/5 đến 22/5")
                .build();

        OrderInfoExtractedDto result = service.extractOrderInfo(List.of(message), 1L);
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        LocalDate expectedFrom = LocalDate.of(today.getYear(), 5, 19);
        LocalDate expectedTo = LocalDate.of(today.getYear(), 5, 22);
        if (expectedFrom.isBefore(today.minusDays(1))) {
            expectedFrom = expectedFrom.plusYears(1);
            expectedTo = expectedTo.plusYears(1);
        }

        assertThat(result.getQuantity()).isEqualTo(1);
        assertThat(result.getRentFrom()).isEqualTo(expectedFrom);
        assertThat(result.getRentTo()).isEqualTo(expectedTo);
        assertThat(result.getRentalDays()).isEqualTo(4);
        assertThat(result.getCustomerName()).isNull();
        assertThat(result.getAddress()).isNull();
        assertThat(result.getProductName()).isNull();
    }

    @Test
    void shouldNotAppendAddressDigitToPhoneInCustomerContactUpdate() {
        Message message = Message.builder()
                .senderType(MessageSenderType.CUSTOMER)
                .senderId("customer")
                .messageTime(LocalDateTime.now())
                .text("hà Hoàng anh 0395253054 12 quang trung hà đông hà nội")
                .build();

        OrderInfoExtractedDto result = service.extractOrderInfo(List.of(message), 1L);

        assertThat(result.getPhone()).isEqualTo("0395253054");
    }
}

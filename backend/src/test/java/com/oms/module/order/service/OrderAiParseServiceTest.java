package com.oms.module.order.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.config.GeminiProperties;
import com.oms.module.order.dto.AiParseRequest;
import com.oms.module.order.dto.AiParseResponse;
import com.oms.module.order.entity.Order;
import com.oms.module.orderform.entity.OrderFormConfig;
import com.oms.module.orderform.entity.OrderFormCustomField;
import com.oms.module.orderform.entity.OrderFormFieldOption;
import com.oms.module.orderform.repository.OrderFormConfigRepository;
import com.oms.module.product.entity.ProductType;
import com.oms.module.shop.entity.ShopOrderSource;
import com.oms.module.shop.entity.ShopShippingMethod;
import com.oms.module.shop.repository.ShopOrderSourceRepository;
import com.oms.module.shop.repository.ShopShippingMethodRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OrderAiParseServiceTest {

    private ShopShippingMethodRepository shippingMethodRepository;
    private ShopOrderSourceRepository orderSourceRepository;
    private OrderFormConfigRepository orderFormConfigRepository;
    private OrderAiParseService service;

    @BeforeEach
    void setUp() {
        shippingMethodRepository = mock(ShopShippingMethodRepository.class);
        orderSourceRepository = mock(ShopOrderSourceRepository.class);
        orderFormConfigRepository = mock(OrderFormConfigRepository.class);

        GeminiProperties geminiProperties = new GeminiProperties();
        geminiProperties.setApiKey("");

        service = new OrderAiParseService(
                geminiProperties,
                new ObjectMapper(),
                shippingMethodRepository,
                orderSourceRepository,
                orderFormConfigRepository
        );
    }

    @Test
    void shouldBuildFallbackDraftFromStructuredText() {
        ShopShippingMethod shippingMethod = ShopShippingMethod.builder()
                .name("Giao hang nhanh")
                .feePolicy(ShopShippingMethod.FeePolicy.FIXED_FEE)
                .defaultFee(new BigDecimal("30000"))
                .isActive(true)
                .build();

        ShopOrderSource orderSource = ShopOrderSource.builder()
                .name("Facebook")
                .isActive(true)
                .build();

        OrderFormFieldOption optionM = OrderFormFieldOption.builder()
                .label("M")
                .value("M")
                .isActive(true)
                .sortOrder(0)
                .build();

        OrderFormCustomField customField = OrderFormCustomField.builder()
                .fieldKey("size_note")
                .label("Size note")
                .fieldType("dropdown")
                .isActive(true)
                .build();
        optionM.setField(customField);
        customField.setOptions(List.of(optionM));

        OrderFormConfig config = OrderFormConfig.builder()
                .formType(ProductType.SELL)
                .customFields(List.of(customField))
                .build();
        customField.setConfig(config);

        when(shippingMethodRepository.findByShopIdAndIsActiveTrue(1L)).thenReturn(List.of(shippingMethod));
        when(orderSourceRepository.findByShopIdAndIsActiveTrue(1L)).thenReturn(List.of(orderSource));
        when(orderFormConfigRepository.findAllByShopIdAndFormType(1L, ProductType.SELL)).thenReturn(List.of(config));

        AiParseRequest request = new AiParseRequest();
        request.setRawText("""
                Ten: Nguyen Van A
                SDT: 84901234567
                Dia chi: 123 Nguyen Trai, Quan 1
                Nguon don: Facebook
                Van chuyen: Giao hang nhanh
                Phi ship: 30000
                Size note: M
                """);
        request.setOrderTypeHint(Order.OrderType.SELL);

        AiParseResponse response = service.parse(1L, request);

        assertEquals(Order.OrderType.SELL, response.getOrderType());
        assertEquals("Nguyen Van A", response.getCustomerName());
        assertEquals("0901234567", response.getCustomerPhone());
        assertEquals("123 Nguyen Trai, Quan 1", response.getCustomerAddress());
        assertEquals("Facebook", response.getSourceChannel());
        assertEquals("Giao hang nhanh", response.getShippingMethod());
        assertEquals(new BigDecimal("30000"), response.getShippingFee());
        assertNotNull(response.getCustomFields());
        assertEquals("M", response.getCustomFields().get("size_note"));
    }

    @Test
    void shouldReturnNullForUnknownConfiguredValues() {
        when(shippingMethodRepository.findByShopIdAndIsActiveTrue(1L)).thenReturn(List.of());
        when(orderSourceRepository.findByShopIdAndIsActiveTrue(1L)).thenReturn(List.of());
        when(orderFormConfigRepository.findAllByShopIdAndFormType(1L, ProductType.RENT)).thenReturn(List.of());

        AiParseRequest request = new AiParseRequest();
        request.setRawText("""
                SDT: 0901111222
                Ghi chu: giao sau 18h
                Ngay nhan: 12/05/2026
                Ngay tra: 14/05/2026
                """);
        request.setOrderTypeHint(Order.OrderType.RENT);

        AiParseResponse response = service.parse(1L, request);

        assertEquals(Order.OrderType.RENT, response.getOrderType());
        assertEquals("0901111222", response.getCustomerPhone());
        assertEquals("2026-05-12", response.getRentFrom());
        assertEquals("2026-05-14", response.getRentTo());
        assertEquals("giao sau 18h", response.getCustomerNote());
        assertNull(response.getSourceChannel());
        assertNull(response.getShippingMethod());
    }
}

package com.oms.module.order.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.common.exception.BusinessException;
import com.oms.module.messenger.service.MessengerOrderNotificationService;
import com.oms.module.order.dto.OrderRequest;
import com.oms.module.order.dto.OrderResponse;
import com.oms.module.order.entity.Order;
import com.oms.module.order.entity.OrderItem;
import com.oms.module.order.mapper.OrderMapper;
import com.oms.module.order.repository.OrderRepository;
import com.oms.module.orderform.service.OrderFormValueValidator;
import com.oms.module.product.entity.Product;
import com.oms.module.product.entity.ProductType;
import com.oms.module.product.entity.ProductVariant;
import com.oms.module.product.repository.ProductVariantRepository;
import com.oms.module.rental.entity.RentalAvailability;
import com.oms.module.rental.repository.RentalAvailabilityRepository;
import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.entity.ShopOrderSource;
import com.oms.module.shop.entity.ShopPaymentConfig;
import com.oms.module.shop.entity.ShopShippingMethod;
import com.oms.module.shop.repository.ShopOrderSourceRepository;
import com.oms.module.shop.repository.ShopPaymentConfigRepository;
import com.oms.module.shop.repository.ShopRepository;
import com.oms.module.shop.repository.ShopShippingMethodRepository;
import com.oms.module.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderServiceTest {

    private OrderRepository orderRepository;
    private ShopRepository shopRepository;
    private ProductVariantRepository variantRepository;
    private RentalAvailabilityRepository availabilityRepository;
    private ShopShippingMethodRepository shippingMethodRepository;
    private ShopOrderSourceRepository orderSourceRepository;
    private ShopPaymentConfigRepository paymentConfigRepository;
    private MessengerOrderNotificationService messengerOrderNotificationService;
    private OrderStatusTransitionService orderStatusTransitionService;
    private OrderService service;

    private Shop shop;
    private ProductVariant sellVariant;
    private ProductVariant rentVariant;
    private ProductVariant sellRentVariant;

    @BeforeEach
    void setUp() {
        orderRepository = mock(OrderRepository.class);
        shopRepository = mock(ShopRepository.class);
        variantRepository = mock(ProductVariantRepository.class);
        availabilityRepository = mock(RentalAvailabilityRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        shippingMethodRepository = mock(ShopShippingMethodRepository.class);
        orderSourceRepository = mock(ShopOrderSourceRepository.class);
        paymentConfigRepository = mock(ShopPaymentConfigRepository.class);
        OrderMapper orderMapper = mock(OrderMapper.class);
        OrderFormValueValidator orderFormValueValidator = mock(OrderFormValueValidator.class);
        messengerOrderNotificationService = mock(MessengerOrderNotificationService.class);
        orderStatusTransitionService = mock(OrderStatusTransitionService.class);
        when(orderFormValueValidator.buildValidatedValues(any(), any(), any())).thenReturn(List.of());

        service = new OrderService(
                orderRepository,
                shopRepository,
                variantRepository,
                availabilityRepository,
                userRepository,
                shippingMethodRepository,
                orderSourceRepository,
                paymentConfigRepository,
                orderMapper,
                new ObjectMapper(),
                orderFormValueValidator,
                messengerOrderNotificationService,
                orderStatusTransitionService
        );

        shop = Shop.builder()
                .name("Demo Shop")
                .slug("demo-shop")
                .status(Shop.ShopStatus.ACTIVE)
                .build();
        shop.setId(1L);

        Product sellProduct = Product.builder()
                .shop(shop)
                .name("Ao thun")
                .productType(ProductType.SELL)
                .build();
        sellProduct.setId(10L);
        sellVariant = ProductVariant.builder()
                .product(sellProduct)
                .size("M")
                .color("Black")
                .stockQty(5)
                .priceSell(new BigDecimal("120000"))
                .build();
        sellVariant.setId(100L);

        Product rentProduct = Product.builder()
                .shop(shop)
                .name("Dam du tiec")
                .productType(ProductType.RENT)
                .build();
        rentProduct.setId(11L);
        rentVariant = ProductVariant.builder()
                .product(rentProduct)
                .size("S")
                .color("Red")
                .stockQty(1)
                .priceRentPerDay(new BigDecimal("250000"))
                .depositAmount(new BigDecimal("500000"))
                .build();
        rentVariant.setId(101L);

        Product sellRentProduct = Product.builder()
                .shop(shop)
                .name("Set ao dai")
                .productType(ProductType.SELL_RENT)
                .build();
        sellRentProduct.setId(12L);
        sellRentVariant = ProductVariant.builder()
                .product(sellRentProduct)
                .size("L")
                .color("White")
                .stockQty(5)
                .priceSell(new BigDecimal("900000"))
                .priceRentPerDay(new BigDecimal("300000"))
                .depositAmount(new BigDecimal("700000"))
                .build();
        sellRentVariant.setId(102L);

        when(shopRepository.findById(1L)).thenReturn(Optional.of(shop));
        when(variantRepository.findByIdForUpdate(100L)).thenReturn(Optional.of(sellVariant));
        when(variantRepository.findByIdForUpdate(101L)).thenReturn(Optional.of(rentVariant));
        when(variantRepository.findByIdForUpdate(102L)).thenReturn(Optional.of(sellRentVariant));
        when(paymentConfigRepository.findByShopId(1L)).thenReturn(Optional.of(ShopPaymentConfig.builder()
                .shop(shop)
                .codEnabled(true)
                .bankTransferEnabled(true)
                .vnpayEnabled(false)
                .build()));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderMapper.toResponse(any(Order.class))).thenAnswer(invocation -> {
            Order order = invocation.getArgument(0);
            return OrderResponse.builder()
                    .orderCode(order.getOrderCode())
                    .orderType(order.getOrderType())
                    .status(order.getStatus())
                    .sourceMethod(order.getSourceMethod())
                    .shippingFee(order.getShippingFee())
                    .totalAmount(order.getTotalAmount())
                    .build();
        });
    }

    @Test
    void createSellOrderShouldCalculateTotalAndUseNewStatus() {
        OrderRequest request = baseRequest(Order.OrderType.SELL, 100L);
        request.setShippingFee(new BigDecimal("30000"));
        request.getItems().get(0).setQuantity(2);

        OrderResponse response = service.createOrder(1L, request, null);

        assertThat(response.getStatus()).isEqualTo(Order.OrderStatus.NEW);
        assertThat(response.getSourceMethod()).isEqualTo(Order.SourceMethod.MANUAL);
        assertThat(response.getShippingFee()).isEqualByComparingTo("30000");
        assertThat(response.getTotalAmount()).isEqualByComparingTo("270000");

        ArgumentCaptor<Order> orderCaptor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository).save(orderCaptor.capture());
        Order savedOrder = orderCaptor.getValue();
        assertThat(savedOrder.getItems()).hasSize(1);
        assertThat(savedOrder.getItems().get(0).getProductNameSnapshot()).isEqualTo("Ao thun");
        assertThat(savedOrder.getItems().get(0).getUnitPrice()).isEqualByComparingTo("120000");
        assertThat(sellVariant.getStockQty()).isEqualTo(3);
    }

    @Test
    void createSellOrderShouldRejectWhenStockIsNotEnough() {
        OrderRequest request = baseRequest(Order.OrderType.SELL, 100L);
        request.getItems().get(0).setQuantity(6);

        assertThatThrownBy(() -> service.createOrder(1L, request, null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("chỉ còn 5")
                .hasMessageContaining("không đủ");

        verify(orderRepository, never()).save(any(Order.class));
        assertThat(sellVariant.getStockQty()).isEqualTo(5);
    }

    @Test
    void createSellOrderShouldAggregateSameVariantBeforeCheckingStock() {
        OrderRequest request = baseRequest(Order.OrderType.SELL, 100L);
        request.getItems().get(0).setQuantity(3);

        OrderRequest.ItemRequest duplicateItem = new OrderRequest.ItemRequest();
        duplicateItem.setVariantId(100L);
        duplicateItem.setQuantity(3);
        request.setItems(List.of(request.getItems().get(0), duplicateItem));

        assertThatThrownBy(() -> service.createOrder(1L, request, null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("chỉ còn 5")
                .hasMessageContaining("không đủ");

        verify(orderRepository, never()).save(any(Order.class));
        assertThat(sellVariant.getStockQty()).isEqualTo(5);
    }

    @Test
    void createRentOrderShouldCalculateTotalForEveryRentalDay() {
        OrderRequest request = baseRequest(Order.OrderType.RENT, 101L);
        request.setRentFrom(LocalDate.of(2026, 5, 20));
        request.setRentTo(LocalDate.of(2026, 5, 22));
        request.setShippingFee(new BigDecimal("50000"));

        OrderResponse response = service.createOrder(1L, request, null);

        assertThat(response.getTotalAmount()).isEqualByComparingTo("800000");

        ArgumentCaptor<Order> orderCaptor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository).save(orderCaptor.capture());
        Order savedOrder = orderCaptor.getValue();
        assertThat(savedOrder.getItems()).hasSize(1);
        assertThat(savedOrder.getItems().get(0).getUnitPrice()).isEqualByComparingTo("250000");
        assertThat(savedOrder.getItems().get(0).getLineTotal()).isEqualByComparingTo("750000");
        assertThat(savedOrder.getTotalAmount()).isEqualByComparingTo("800000");
    }

    private OrderRequest baseRequest(Order.OrderType type, Long variantId) {
        OrderRequest request = new OrderRequest();
        request.setOrderType(type);
        request.setCustomerName("Nguyen Van A");
        request.setCustomerPhone("0900000000");
        request.setCustomerAddress("HCMC");
        request.setCustomerNote("note");
        request.setSourceMethod(Order.SourceMethod.MANUAL);
        request.setShippingMethod("GHTK");
        request.setItems(List.of(itemRequest(variantId)));
        return request;
    }

    private OrderRequest.ItemRequest itemRequest(Long variantId) {
        OrderRequest.ItemRequest item = new OrderRequest.ItemRequest();
        item.setVariantId(variantId);
        item.setQuantity(1);
        return item;
    }
}

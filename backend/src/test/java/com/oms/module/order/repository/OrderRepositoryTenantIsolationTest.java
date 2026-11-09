package com.oms.module.order.repository;

import com.oms.module.order.entity.Order;
import com.oms.module.shop.entity.Shop;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class OrderRepositoryTenantIsolationTest {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager entityManager;

    @Test
    void shouldOnlyReturnOrdersForRequestedShop() {
        Shop firstShop = persistShop("tenant-a");
        Shop secondShop = persistShop("tenant-b");
        Order firstOrder = persistOrder(firstShop, "ORD-TENANT-A");
        persistOrder(secondShop, "ORD-TENANT-B");

        var firstShopOrders = orderRepository.findByShopId(firstShop.getId(), PageRequest.of(0, 10));

        assertThat(firstShopOrders.getContent()).extracting(Order::getOrderCode)
                .containsExactly("ORD-TENANT-A");
        assertThat(orderRepository.findByIdAndShopId(firstOrder.getId(), secondShop.getId())).isEmpty();
    }

    private Shop persistShop(String slug) {
        Shop shop = Shop.builder()
                .name(slug)
                .slug(slug)
                .status(Shop.ShopStatus.ACTIVE)
                .build();
        shop.setCreatedAt(LocalDateTime.now());
        return entityManager.persistAndFlush(shop);
    }

    private Order persistOrder(Shop shop, String orderCode) {
        Order order = Order.builder()
                .shop(shop)
                .orderCode(orderCode)
                .orderType(Order.OrderType.SELL)
                .status(Order.OrderStatus.NEW)
                .build();
        order.setCreatedAt(LocalDateTime.now());
        return entityManager.persistAndFlush(order);
    }
}

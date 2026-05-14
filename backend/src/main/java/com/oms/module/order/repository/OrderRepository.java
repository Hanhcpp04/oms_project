package com.oms.module.order.repository;

import com.oms.module.order.entity.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    Optional<Order> findByOrderCode(String orderCode);

    Optional<Order> findByIdAndShopId(Long id, Long shopId);

    Page<Order> findByShopId(Long shopId, Pageable pageable);

    @Query("SELECT o FROM Order o WHERE o.shop.id = :shopId " +
           "AND (:status IS NULL OR o.status = :status) " +
           "AND (:type IS NULL OR o.orderType = :type) " +
           "AND (:fromDate IS NULL OR o.createdAt >= :fromDate) " +
           "AND (:toDate IS NULL OR o.createdAt <= :toDate) " +
           "AND (:keyword IS NULL OR o.customerName LIKE %:keyword% OR o.orderCode LIKE %:keyword%)")
    Page<Order> searchOrders(@Param("shopId") Long shopId,
                             @Param("status") Order.OrderStatus status,
                             @Param("type") Order.OrderType type,
                             @Param("fromDate") java.time.LocalDateTime fromDate,
                             @Param("toDate") java.time.LocalDateTime toDate,
                             @Param("keyword") String keyword,
                             Pageable pageable);

    long countByShopIdAndStatus(Long shopId, Order.OrderStatus status);

    long countByShopIdAndOrderTypeAndStatus(Long shopId, Order.OrderType orderType, Order.OrderStatus status);

    @Query("SELECT SUM(o.totalAmount) FROM Order o WHERE o.shop.id = :shopId AND o.status = :status")
    java.math.BigDecimal sumTotalAmountByShopIdAndStatus(@Param("shopId") Long shopId, @Param("status") Order.OrderStatus status);

    @Query("SELECT SUM(o.totalAmount) FROM Order o WHERE o.shop.id = :shopId AND o.orderType = :orderType AND o.status = :status")
    java.math.BigDecimal sumTotalAmountByShopIdAndOrderTypeAndStatus(@Param("shopId") Long shopId, @Param("orderType") Order.OrderType orderType, @Param("status") Order.OrderStatus status);

    @Query("SELECT COUNT(o) FROM Order o WHERE o.shop.id = :shopId AND o.status NOT IN (:excludedStatuses)")
    long countOpenOrders(@Param("shopId") Long shopId, @Param("excludedStatuses") java.util.Collection<Order.OrderStatus> excludedStatuses);

    @Query("SELECT COUNT(o) FROM Order o WHERE o.shop.id = :shopId AND o.orderType = :orderType AND o.status NOT IN (:excludedStatuses)")
    long countOpenOrdersByType(@Param("shopId") Long shopId, @Param("orderType") Order.OrderType orderType, @Param("excludedStatuses") java.util.Collection<Order.OrderStatus> excludedStatuses);
}

package com.oms.module.notification.repository;

import com.oms.module.notification.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    Page<Notification> findByShopIdOrderByCreatedAtDesc(Long shopId, Pageable pageable);

    long countByShopIdAndReadAtIsNull(Long shopId);

    Optional<Notification> findByIdAndShopId(Long id, Long shopId);

    @Modifying
    @Query("""
            UPDATE Notification n
            SET n.readAt = :readAt
            WHERE n.shop.id = :shopId AND n.readAt IS NULL
            """)
    int markAllReadByShopId(@Param("shopId") Long shopId, @Param("readAt") LocalDateTime readAt);
}

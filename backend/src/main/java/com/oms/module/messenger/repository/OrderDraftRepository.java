package com.oms.module.messenger.repository;

import com.oms.module.messenger.entity.OrderDraft;
import com.oms.module.messenger.enums.OrderDraftStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Optional;

@Repository
public interface OrderDraftRepository extends JpaRepository<OrderDraft, Long> {

    Optional<OrderDraft> findTopByConversationIdAndStatusOrderByCreatedAtDesc(
            Long conversationId,
            OrderDraftStatus status
    );

    Optional<OrderDraft> findBySourceMessageMid(String sourceMessageMid);

    Optional<OrderDraft> findTopByConversationIdAndStatusInOrderByCreatedAtDesc(
            Long conversationId,
            Collection<OrderDraftStatus> statuses
    );

    Optional<OrderDraft> findTopByPageIdAndCustomerPsidAndStatusInOrderByCreatedAtDesc(
            String pageId,
            String customerPsid,
            Collection<OrderDraftStatus> statuses
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select d from MessengerOrderDraft d
            where d.id = :id
            """)
    Optional<OrderDraft> findByIdForUpdate(@Param("id") Long id);
}

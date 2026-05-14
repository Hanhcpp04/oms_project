package com.oms.module.messenger.repository;

import com.oms.module.messenger.entity.OrderDraft;
import com.oms.module.messenger.enums.OrderDraftStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OrderDraftRepository extends JpaRepository<OrderDraft, Long> {

    Optional<OrderDraft> findTopByConversationIdAndStatusOrderByCreatedAtDesc(
            Long conversationId,
            OrderDraftStatus status
    );
}

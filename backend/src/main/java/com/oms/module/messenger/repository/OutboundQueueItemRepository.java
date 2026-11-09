package com.oms.module.messenger.repository;

import com.oms.module.messenger.entity.OutboundQueueItem;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface OutboundQueueItemRepository extends JpaRepository<OutboundQueueItem, Long> {
    List<OutboundQueueItem> findByStatusAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(
            OutboundQueueItem.QueueStatus status,
            LocalDateTime nextAttemptAt,
            Pageable pageable
    );
}

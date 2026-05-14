package com.oms.module.messenger.repository;

import com.oms.module.messenger.entity.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByConversationIdOrderByMessageTimeAsc(Long conversationId);

    List<Message> findByConversationIdOrderByMessageTimeDesc(Long conversationId, Pageable pageable);

    List<Message> findByConversationIdAndMessageTimeAfterOrderByMessageTimeDesc(
            Long conversationId,
            LocalDateTime messageTime,
            Pageable pageable
    );
}

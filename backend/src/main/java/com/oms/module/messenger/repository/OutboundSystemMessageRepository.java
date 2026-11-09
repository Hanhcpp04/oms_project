package com.oms.module.messenger.repository;

import com.oms.module.messenger.entity.OutboundSystemMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OutboundSystemMessageRepository extends JpaRepository<OutboundSystemMessage, Long> {

    boolean existsByMessageId(String messageId);

    Optional<OutboundSystemMessage> findByMessageId(String messageId);
}

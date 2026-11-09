package com.oms.module.messenger.repository;

import com.oms.module.messenger.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    Optional<Conversation> findByConversationKey(String conversationKey);

    @Query("""
            select c from MessengerConversation c
            where exists (
                select 1 from MessengerPage p
                where p.pageId = c.pageId
                  and p.shop.id = :shopId
                  and p.enabled = true
            )
            """)
    Page<Conversation> findAllByShopId(@Param("shopId") Long shopId, Pageable pageable);

    @Query("""
            select c from MessengerConversation c
            where c.id = :conversationId
              and exists (
                  select 1 from MessengerPage p
                  where p.pageId = c.pageId
                    and p.shop.id = :shopId
                    and p.enabled = true
              )
            """)
    Optional<Conversation> findByIdAndShopId(
            @Param("conversationId") Long conversationId,
            @Param("shopId") Long shopId
    );
}

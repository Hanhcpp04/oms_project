package com.oms.module.messenger.repository;

import com.oms.module.messenger.entity.MessengerOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MessengerOrderRepository extends JpaRepository<MessengerOrder, Long> {

    boolean existsByOrderDraftId(Long orderDraftId);

    Optional<MessengerOrder> findByOrderDraftId(Long orderDraftId);
}

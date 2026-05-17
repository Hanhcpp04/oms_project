package com.oms.module.messenger.repository;

import com.oms.module.messenger.entity.MessengerPage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MessengerPageRepository extends JpaRepository<MessengerPage, Long> {

    Optional<MessengerPage> findByPageId(String pageId);

    Optional<MessengerPage> findByPageIdAndEnabledTrue(String pageId);
}

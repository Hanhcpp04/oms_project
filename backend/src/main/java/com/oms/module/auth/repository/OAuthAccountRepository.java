package com.oms.module.auth.repository;

import com.oms.module.auth.entity.OAuthAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OAuthAccountRepository extends JpaRepository<OAuthAccount, Long> {

    Optional<OAuthAccount> findByProviderAndProviderUserId(String provider, String providerUserId);

    Optional<OAuthAccount> findByProviderAndUser_Id(String provider, Long userId);
}

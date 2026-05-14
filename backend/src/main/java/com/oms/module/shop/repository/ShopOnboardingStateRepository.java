package com.oms.module.shop.repository;

import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.entity.ShopOnboardingState;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ShopOnboardingStateRepository extends JpaRepository<ShopOnboardingState, Long> {

    Optional<ShopOnboardingState> findFirstByShopOrderByIdDesc(Shop shop);
}

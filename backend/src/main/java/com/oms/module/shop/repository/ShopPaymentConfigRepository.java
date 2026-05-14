package com.oms.module.shop.repository;

import com.oms.module.shop.entity.ShopPaymentConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ShopPaymentConfigRepository extends JpaRepository<ShopPaymentConfig, Long> {
    Optional<ShopPaymentConfig> findByShopId(Long shopId);
}

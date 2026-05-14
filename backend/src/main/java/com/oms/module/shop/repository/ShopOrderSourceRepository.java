package com.oms.module.shop.repository;

import com.oms.module.shop.entity.ShopOrderSource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ShopOrderSourceRepository extends JpaRepository<ShopOrderSource, Long> {
    List<ShopOrderSource> findByShopId(Long shopId);
    List<ShopOrderSource> findByShopIdAndIsActiveTrue(Long shopId);
}

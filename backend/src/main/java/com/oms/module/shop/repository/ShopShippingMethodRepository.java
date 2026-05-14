package com.oms.module.shop.repository;

import com.oms.module.shop.entity.ShopShippingMethod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ShopShippingMethodRepository extends JpaRepository<ShopShippingMethod, Long> {
    List<ShopShippingMethod> findByShopId(Long shopId);
    List<ShopShippingMethod> findByShopIdAndIsActiveTrue(Long shopId);
}

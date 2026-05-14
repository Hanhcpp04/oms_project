package com.oms.module.shop.repository;

import com.oms.module.shop.entity.Shop;
import com.oms.module.shop.entity.ShopAddress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShopAddressRepository extends JpaRepository<ShopAddress, Long> {
    List<ShopAddress> findByShop(Shop shop);
    List<ShopAddress> findByShopOrderByIsDefaultDescIdAsc(Shop shop);
    Optional<ShopAddress> findByIdAndShop(Long id, Shop shop);
    void deleteByShop(Shop shop);
}

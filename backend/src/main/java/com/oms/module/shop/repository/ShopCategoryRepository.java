package com.oms.module.shop.repository;

import com.oms.module.shop.entity.ShopCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShopCategoryRepository extends JpaRepository<ShopCategory, Long> {
    List<ShopCategory> findAllByShopId(Long shopId);
    Optional<ShopCategory> findFirstByShopIdAndName(Long shopId, String name);
    void deleteAllByShopId(Long shopId);
}

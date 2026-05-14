package com.oms.module.product.repository;

import com.oms.module.product.entity.Product;
import com.oms.module.product.entity.ProductType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

    Page<Product> findByShopIdAndIsActiveTrue(Long shopId, Pageable pageable);

    List<Product> findAllByShopIdAndIsActiveTrue(Long shopId);

    Optional<Product> findByIdAndShopId(Long id, Long shopId);

    @Query("SELECT p FROM Product p WHERE p.shop.id = :shopId " +
           "AND (:keyword IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "AND (:type IS NULL OR p.productType = :type)")
    Page<Product> searchProducts(@Param("shopId") Long shopId,
                                 @Param("keyword") String keyword,
                                 @Param("type") ProductType type,
                                 Pageable pageable);
}

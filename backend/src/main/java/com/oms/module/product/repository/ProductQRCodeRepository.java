package com.oms.module.product.repository;

import com.oms.module.product.entity.ProductQRCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductQRCodeRepository extends JpaRepository<ProductQRCode, Long> {
    List<ProductQRCode> findByProductIdOrderByCreatedAtDesc(Long productId);
}

package com.oms.module.productform.repository;

import com.oms.module.product.entity.ProductType;
import com.oms.module.productform.entity.ProductFormConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductFormConfigRepository extends JpaRepository<ProductFormConfig, Long> {

    List<ProductFormConfig> findAllByShopIdAndFormType(Long shopId, ProductType formType);
}


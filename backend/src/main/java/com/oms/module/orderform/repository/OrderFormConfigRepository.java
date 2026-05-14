package com.oms.module.orderform.repository;

import com.oms.module.product.entity.ProductType;
import com.oms.module.orderform.entity.OrderFormConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrderFormConfigRepository extends JpaRepository<OrderFormConfig, Long> {

    List<OrderFormConfig> findAllByShopIdAndFormType(Long shopId, ProductType formType);
}

package com.oms.module.orderform.repository;

import com.oms.module.orderform.entity.OrderFormCustomField;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OrderFormCustomFieldRepository extends JpaRepository<OrderFormCustomField, Long> {
    Optional<OrderFormCustomField> findByIdAndConfigId(Long id, Long configId);
    boolean existsByConfigIdAndFieldKeyIgnoreCase(Long configId, String fieldKey);
    boolean existsByConfigIdAndFieldKeyIgnoreCaseAndIdNot(Long configId, String fieldKey, Long id);
}

package com.oms.module.orderform.repository;

import com.oms.module.orderform.entity.OrderFormFieldOption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OrderFormFieldOptionRepository extends JpaRepository<OrderFormFieldOption, Long> {
    Optional<OrderFormFieldOption> findByIdAndFieldId(Long id, Long fieldId);
}

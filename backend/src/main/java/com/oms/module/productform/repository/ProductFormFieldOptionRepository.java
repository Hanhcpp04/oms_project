package com.oms.module.productform.repository;

import com.oms.module.productform.entity.ProductFormFieldOption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProductFormFieldOptionRepository extends JpaRepository<ProductFormFieldOption, Long> {
    Optional<ProductFormFieldOption> findByIdAndFieldId(Long id, Long fieldId);
}

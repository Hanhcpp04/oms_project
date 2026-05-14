package com.oms.module.productform.repository;

import com.oms.module.productform.entity.ProductFormCustomField;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProductFormCustomFieldRepository extends JpaRepository<ProductFormCustomField, Long> {
    Optional<ProductFormCustomField> findByIdAndConfigId(Long id, Long configId);
    boolean existsByConfigIdAndFieldKeyIgnoreCase(Long configId, String fieldKey);
    boolean existsByConfigIdAndFieldKeyIgnoreCaseAndIdNot(Long configId, String fieldKey, Long id);
}

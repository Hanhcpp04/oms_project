package com.oms.module.formtemplate.repository;

import com.oms.module.formtemplate.entity.FormTemplateField;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FormTemplateFieldRepository extends JpaRepository<FormTemplateField, Long> {

    boolean existsByTemplateIdAndFieldKeyIgnoreCase(Long templateId, String fieldKey);

    boolean existsByTemplateIdAndFieldKeyIgnoreCaseAndIdNot(Long templateId, String fieldKey, Long id);

    boolean existsByTemplateIdAndSemanticKeyIgnoreCase(Long templateId, String semanticKey);

    boolean existsByTemplateIdAndSemanticKeyIgnoreCaseAndIdNot(Long templateId, String semanticKey, Long id);

    Optional<FormTemplateField> findByIdAndTemplateId(Long id, Long templateId);
}

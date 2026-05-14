package com.oms.module.formtemplate.repository;

import com.oms.module.formtemplate.entity.FormTemplateFieldOption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FormTemplateFieldOptionRepository extends JpaRepository<FormTemplateFieldOption, Long> {

    Optional<FormTemplateFieldOption> findByIdAndFieldId(Long id, Long fieldId);
}

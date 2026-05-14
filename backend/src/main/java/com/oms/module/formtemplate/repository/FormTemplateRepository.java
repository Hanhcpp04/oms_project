package com.oms.module.formtemplate.repository;

import com.oms.module.formtemplate.entity.FormTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FormTemplateRepository extends JpaRepository<FormTemplate, Long> {

    List<FormTemplate> findByShopIdOrderByUpdatedAtDesc(Long shopId);

    List<FormTemplate> findByShopIdAndFormTypeOrderByUpdatedAtDesc(Long shopId, FormTemplate.FormType formType);

    List<FormTemplate> findByShopIdAndStatusOrderByUpdatedAtDesc(Long shopId, FormTemplate.FormStatus status);

    List<FormTemplate> findByShopIdAndCategoryOrderByUpdatedAtDesc(Long shopId, FormTemplate.FormCategory category);

    Optional<FormTemplate> findByIdAndShopId(Long id, Long shopId);

    Optional<FormTemplate> findByIdAndIsPublicTrueAndStatus(Long id, FormTemplate.FormStatus status);

    boolean existsByPublicSlug(String publicSlug);
}

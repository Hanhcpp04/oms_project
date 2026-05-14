package com.oms.config;

import com.oms.module.user.entity.Permission;
import com.oms.module.user.repository.PermissionRepository;
import com.oms.security.PermissionCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Initializes the permissions table on application startup.
 * Syncs all PermissionCode enum values into the database.
 * Safe to run multiple times — skips existing permissions.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PermissionDataInitializer implements ApplicationRunner {

    private final PermissionRepository permissionRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        int created = 0;
        for (PermissionCode code : PermissionCode.values()) {
            if (!permissionRepository.existsByCode(code.name())) {
                Permission permission = Permission.builder()
                        .code(code.name())
                        .name(code.getDisplayName())
                        .category(code.getCategory())
                        .description(code.getDisplayName())
                        .build();
                permissionRepository.save(permission);
                created++;
            }
        }
        if (created > 0) {
            log.info("Initialized {} new permissions in database", created);
        }
    }
}

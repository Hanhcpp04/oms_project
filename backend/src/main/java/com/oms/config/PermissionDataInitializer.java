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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

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
        int updated = 0;
        Map<String, Permission> existingPermissions = permissionRepository.findAll().stream()
                .collect(Collectors.toMap(Permission::getCode, Function.identity(), (left, right) -> left));
        List<Permission> permissionsToSave = new ArrayList<>();

        for (PermissionCode code : PermissionCode.values()) {
            Permission permission = existingPermissions.get(code.name());
            if (permission == null) {
                Permission newPermission = Permission.builder()
                        .code(code.name())
                        .name(code.getDisplayName())
                        .category(code.getCategory())
                        .description(code.getDisplayName())
                        .build();
                permissionsToSave.add(newPermission);
                created++;
                continue;
            }

            if (syncPermission(permission, code)) {
                permissionsToSave.add(permission);
                updated++;
            }
        }

        if (!permissionsToSave.isEmpty()) {
            permissionRepository.saveAll(permissionsToSave);
        }

        if (created > 0 || updated > 0) {
            log.info("Synced permissions in database: created={}, updated={}", created, updated);
        }
    }

    private boolean syncPermission(Permission permission, PermissionCode code) {
        boolean changed = false;

        if (!Objects.equals(code.getDisplayName(), permission.getName())) {
            permission.setName(code.getDisplayName());
            changed = true;
        }

        if (!Objects.equals(code.getCategory(), permission.getCategory())) {
            permission.setCategory(code.getCategory());
            changed = true;
        }

        if (!Objects.equals(code.getDisplayName(), permission.getDescription())) {
            permission.setDescription(code.getDisplayName());
            changed = true;
        }

        return changed;
    }
}

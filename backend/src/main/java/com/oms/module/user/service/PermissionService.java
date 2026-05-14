package com.oms.module.user.service;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.module.user.entity.Permission;
import com.oms.module.user.entity.StaffPermission;
import com.oms.module.user.entity.User;
import com.oms.module.user.repository.PermissionRepository;
import com.oms.module.user.repository.StaffPermissionRepository;
import com.oms.module.user.repository.UserRepository;
import com.oms.security.PermissionCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Service for managing staff permissions.
 * OWNER always has all permissions — this service only manages STAFF permissions.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PermissionService {

    private final PermissionRepository permissionRepository;
    private final StaffPermissionRepository staffPermissionRepository;
    private final UserRepository userRepository;

    /**
     * Check if a user has a specific permission.
     * - ADMIN: always true (platform admin)
     * - OWNER: always true (shop owner has all permissions)
     * - STAFF: check staff_permissions table
     */
    @Transactional(readOnly = true)
    public boolean hasPermission(Long userId, PermissionCode permissionCode) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        // ADMIN and OWNER always have all permissions
        if (user.getRole() == User.UserRole.ADMIN || user.getRole() == User.UserRole.OWNER) {
            return true;
        }

        // STAFF_SCHEDULE_VIEW_OWN is always granted to staff (cannot be revoked)
        if (permissionCode == PermissionCode.STAFF_SCHEDULE_VIEW_OWN) {
            return true;
        }

        return staffPermissionRepository.existsByUserIdAndPermissionCode(userId, permissionCode.name());
    }

    /**
     * Get all permission codes granted to a staff user.
     */
    @Transactional(readOnly = true)
    public List<String> getStaffPermissionCodes(Long staffId) {
        List<String> codes = staffPermissionRepository.findPermissionCodesByUserId(staffId);
        // Always include STAFF_SCHEDULE_VIEW_OWN
        if (!codes.contains(PermissionCode.STAFF_SCHEDULE_VIEW_OWN.name())) {
            codes = new ArrayList<>(codes);
            codes.add(PermissionCode.STAFF_SCHEDULE_VIEW_OWN.name());
        }
        return codes;
    }

    /**
     * Get all permissions with their grant status for a specific staff member.
     */
    @Transactional(readOnly = true)
    public List<Permission> getAllPermissions() {
        return permissionRepository.findAll();
    }

    /**
     * Get permissions granted to a specific staff member.
     */
    @Transactional(readOnly = true)
    public List<StaffPermission> getStaffPermissions(Long staffId) {
        return staffPermissionRepository.findByUserId(staffId);
    }

    /**
     * Update all permissions for a staff member.
     * Called by shop OWNER to grant/revoke permissions.
     *
     * @param ownerId          the owner performing the update
     * @param staffId          the staff user to update
     * @param permissionCodes  the new set of permission codes to grant
     */
    @Transactional
    public List<String> updateStaffPermissions(Long ownerId, Long staffId, List<String> permissionCodes) {
        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        if (owner.getRole() != User.UserRole.OWNER) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only OWNER can manage staff permissions");
        }

        User staff = userRepository.findById(staffId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND, "Staff not found"));

        if (staff.getRole() != User.UserRole.STAFF) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Target user is not a STAFF member");
        }

        // Verify staff belongs to same shop as owner
        if (staff.getShop() == null || owner.getShop() == null
                || !staff.getShop().getId().equals(owner.getShop().getId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Staff does not belong to your shop");
        }

        List<String> requestedCodes = permissionCodes == null ? List.of() : permissionCodes;

        // Remove STAFF_SCHEDULE_VIEW_OWN from input (it's always granted)
        Set<String> codesToGrant = requestedCodes.stream()
                .filter(code -> !PermissionCode.STAFF_SCHEDULE_VIEW_OWN.name().equals(code))
                .collect(Collectors.toCollection(LinkedHashSet::new));

        List<StaffPermission> existingPermissions = staffPermissionRepository.findByUserId(staffId);
        Map<String, StaffPermission> existingByCode = existingPermissions.stream()
                .collect(Collectors.toMap(sp -> sp.getPermission().getCode(), sp -> sp));

        List<StaffPermission> permissionsToRemove = existingPermissions.stream()
                .filter(sp -> !codesToGrant.contains(sp.getPermission().getCode()))
                .toList();

        if (!permissionsToRemove.isEmpty()) {
            staffPermissionRepository.deleteAllInBatch(permissionsToRemove);
        }

        List<StaffPermission> newPermissions = new ArrayList<>();
        for (String code : codesToGrant) {
            if (existingByCode.containsKey(code)) {
                continue;
            }

            Permission permission = permissionRepository.findByCode(code)
                    .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid permission code: " + code));

            StaffPermission sp = StaffPermission.builder()
                    .user(staff)
                    .permission(permission)
                    .grantedBy(owner)
                    .build();
            newPermissions.add(sp);
        }

        staffPermissionRepository.saveAll(newPermissions);

        log.info("Owner {} updated permissions for staff {}: {}", ownerId, staffId, codesToGrant);

        return getStaffPermissionCodes(staffId);
    }

    /**
     * Grant default permissions to a newly created staff member.
     * Default: PRODUCT_VIEW, ORDER_VIEW, STAFF_SCHEDULE_VIEW_OWN
     */
    @Transactional
    public void grantDefaultPermissions(User staff, User owner) {
        List<String> defaultCodes = List.of(
                PermissionCode.PRODUCT_VIEW.name(),
                PermissionCode.ORDER_VIEW.name()
        );

        for (String code : defaultCodes) {
            permissionRepository.findByCode(code).ifPresent(permission -> {
                StaffPermission sp = StaffPermission.builder()
                        .user(staff)
                        .permission(permission)
                        .grantedBy(owner)
                        .build();
                staffPermissionRepository.save(sp);
            });
        }

        log.info("Granted default permissions to new staff {}: {}", staff.getId(), defaultCodes);
    }
}

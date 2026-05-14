package com.oms.security;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.module.user.service.PermissionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.stereotype.Component;

/**
 * AOP Aspect that enforces @RequirePermission checks before method execution.
 *
 * Logic:
 * - ADMIN → bypass (platform admin)
 * - OWNER → bypass (has all shop permissions)
 * - STAFF → check each required permission against staff_permissions table
 */
@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
public class RequirePermissionAspect {

    private final PermissionService permissionService;

    @Before("@annotation(requirePermission)")
    public void checkPermission(JoinPoint joinPoint, RequirePermission requirePermission) {
        CustomUserDetails user = ShopContext.currentUser();

        // ADMIN bypasses all permission checks
        if ("ADMIN".equals(user.getRole())) {
            return;
        }

        // OWNER has all permissions for their shop
        if ("OWNER".equals(user.getRole())) {
            return;
        }

        // STAFF — check each required permission
        for (PermissionCode code : requirePermission.value()) {
            if (!permissionService.hasPermission(user.getUserId(), code)) {
                log.warn("Permission denied: user {} lacks permission {} for method {}",
                        user.getUserId(), code.name(), joinPoint.getSignature().getName());
                throw new BusinessException(ErrorCode.FORBIDDEN,
                        "Bạn không có quyền thực hiện hành động này: " + code.getDisplayName());
            }
        }
    }
}

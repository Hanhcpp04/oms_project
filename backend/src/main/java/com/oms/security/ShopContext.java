package com.oms.security;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Utility to access the current authenticated user's shop context.
 * Use this in services and controllers to enforce data isolation.
 */
public final class ShopContext {

    private ShopContext() {}

    /**
     * Get the current authenticated user from SecurityContext.
     * @throws BusinessException if no user is authenticated
     */
    public static CustomUserDetails currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof CustomUserDetails)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "No authenticated user");
        }
        return (CustomUserDetails) auth.getPrincipal();
    }

    /**
     * Get the shopId of the current user, throwing if not associated with any shop.
     */
    public static Long requireShopId() {
        CustomUserDetails user = currentUser();
        Long shopId = user.getShopId();
        if (shopId == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "User chưa thuộc shop nào");
        }
        return shopId;
    }

    /**
     * Assert that a resource's shopId matches the current user's shopId.
     * Prevents cross-shop data access.
     */
    public static void assertSameShop(Long resourceShopId) {
        Long currentShopId = requireShopId();
        if (!currentShopId.equals(resourceShopId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Không có quyền truy cập resource của shop khác");
        }
    }

    /**
     * Check if the current user is an ADMIN (platform level).
     */
    public static boolean isAdmin() {
        return "ADMIN".equals(currentUser().getRole());
    }

    /**
     * Check if the current user is a shop OWNER.
     */
    public static boolean isOwner() {
        return "OWNER".equals(currentUser().getRole());
    }

    /**
     * Check if the current user is STAFF.
     */
    public static boolean isStaff() {
        return "STAFF".equals(currentUser().getRole());
    }
}

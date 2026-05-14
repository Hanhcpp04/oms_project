package com.oms.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Method-level annotation to enforce permission checks.
 *
 * - ADMIN: always bypasses (platform admin)
 * - OWNER: always has all permissions for their shop
 * - STAFF: checked against staff_permissions table
 *
 * Usage:
 * <pre>
 *   @RequirePermission(PermissionCode.PRODUCT_CREATE)
 *   public void createProduct(...) { ... }
 *
 *   @RequirePermission({PermissionCode.ORDER_VIEW, PermissionCode.ORDER_CREATE})
 *   public void someMethod(...) { ... }  // requires ALL listed permissions
 * </pre>
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RequirePermission {
    PermissionCode[] value();
}

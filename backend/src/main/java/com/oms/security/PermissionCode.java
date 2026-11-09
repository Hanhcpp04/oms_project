package com.oms.security;

/**
 * All permission codes in the system.
 * Used by @RequirePermission annotation and stored in the permissions table.
 */
public enum PermissionCode {

    // ===== SHOP =====
    SHOP_SETTINGS("Quản lý cài đặt shop", "SHOP", false, false),

    // ===== STAFF =====
    STAFF_MANAGE("Quản lý nhân viên và phân quyền", "STAFF", false, false),
    STAFF_SCHEDULE_MANAGE("Quản lý ca làm việc", "STAFF", false, false),
    STAFF_SCHEDULE_VIEW_OWN("Xem lịch làm của mình", "STAFF", true, true),

    // ===== PRODUCT =====
    PRODUCT_VIEW("Xem sản phẩm", "PRODUCT"),
    PRODUCT_CREATE("Tạo sản phẩm", "PRODUCT"),
    PRODUCT_EDIT("Sửa sản phẩm", "PRODUCT"),
    PRODUCT_DELETE("Xóa sản phẩm", "PRODUCT"),
    PRODUCT_QR_CREATE("Tạo QR thanh toán sản phẩm", "PRODUCT"),

    // ===== ORDER =====
    ORDER_VIEW("Xem đơn hàng", "ORDER"),
    ORDER_CREATE("Tạo đơn hàng", "ORDER"),
    ORDER_UPDATE_STATUS("Cập nhật trạng thái đơn", "ORDER"),

    // ===== REPORT =====
    REPORT_REVENUE("Xem báo cáo doanh thu", "REPORT");

    private final String displayName;
    private final String category;
    private final boolean staffAssignable;
    private final boolean alwaysGrantedToStaff;

    PermissionCode(String displayName, String category) {
        this(displayName, category, true, false);
    }

    PermissionCode(String displayName, String category, boolean staffAssignable, boolean alwaysGrantedToStaff) {
        this.displayName = displayName;
        this.category = category;
        this.staffAssignable = staffAssignable;
        this.alwaysGrantedToStaff = alwaysGrantedToStaff;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getCategory() {
        return category;
    }

    public boolean isStaffAssignable() {
        return staffAssignable;
    }

    public boolean isAlwaysGrantedToStaff() {
        return alwaysGrantedToStaff;
    }

    public static PermissionCode fromCode(String code) {
        if (code == null) {
            throw new IllegalArgumentException("Permission code is required");
        }

        return PermissionCode.valueOf(code.trim());
    }

    public static boolean isStaffAssignableCode(String code) {
        try {
            return fromCode(code).isStaffAssignable();
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }
}

package com.oms.security;

/**
 * All permission codes in the system.
 * Used by @RequirePermission annotation and stored in the permissions table.
 */
public enum PermissionCode {

    // ===== SHOP =====
    SHOP_SETTINGS("Quản lý cài đặt shop", "SHOP"),

    // ===== STAFF =====
    STAFF_MANAGE("Tạo/xóa nhân viên", "STAFF"),
    STAFF_SCHEDULE_MANAGE("Quản lý ca làm việc", "STAFF"),
    STAFF_SCHEDULE_VIEW_OWN("Xem lịch làm của mình", "STAFF"),

    // ===== PRODUCT =====
    PRODUCT_VIEW("Xem sản phẩm", "PRODUCT"),
    PRODUCT_CREATE("Tạo sản phẩm", "PRODUCT"),
    PRODUCT_EDIT("Sửa sản phẩm", "PRODUCT"),
    PRODUCT_DELETE("Xóa sản phẩm", "PRODUCT"),

    // ===== ORDER =====
    ORDER_VIEW("Xem đơn hàng", "ORDER"),
    ORDER_CREATE("Tạo đơn hàng", "ORDER"),
    ORDER_UPDATE_STATUS("Cập nhật trạng thái đơn", "ORDER"),

    // ===== REPORT =====
    REPORT_REVENUE("Xem báo cáo doanh thu", "REPORT");

    private final String displayName;
    private final String category;

    PermissionCode(String displayName, String category) {
        this.displayName = displayName;
        this.category = category;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getCategory() {
        return category;
    }
}

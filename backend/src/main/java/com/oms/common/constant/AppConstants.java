package com.oms.common.constant;

/**
 * Application-wide constants.
 */
public final class AppConstants {

    private AppConstants() {
        throw new UnsupportedOperationException("Utility class");
    }

    // ==================== Pagination ====================
    public static final String DEFAULT_PAGE_NUMBER = "0";
    public static final String DEFAULT_PAGE_SIZE = "10";
    public static final String DEFAULT_SORT_BY = "createdAt";
    public static final String DEFAULT_SORT_DIR = "desc";
    public static final int MAX_PAGE_SIZE = 100;

    // ==================== Security ====================
    public static final String TOKEN_PREFIX = "Bearer ";
    public static final String HEADER_AUTHORIZATION = "Authorization";

    // ==================== Roles ====================
    public static final String ROLE_OWNER = "OWNER";
    public static final String ROLE_STAFF = "STAFF";
    public static final String ROLE_ADMIN = "ADMIN";

    // ==================== Order Types ====================
    public static final String ORDER_TYPE_SELL = "sell";
    public static final String ORDER_TYPE_RENT = "rent";
}

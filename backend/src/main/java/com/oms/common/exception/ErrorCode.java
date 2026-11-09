package com.oms.common.exception;

import lombok.Getter;

/**
 * Enum defining all application error codes.
 * Format: MODULE_ERROR_DESCRIPTION
 */
@Getter
public enum ErrorCode {

    // ==================== Common ====================
    INTERNAL_ERROR("E000", "Internal server error"),
    VALIDATION_ERROR("E001", "Validation failed"),
    RESOURCE_NOT_FOUND("E002", "Resource not found"),
    DUPLICATE_RESOURCE("E003", "Resource already exists"),
    UNAUTHORIZED("E004", "Unauthorized access"),
    FORBIDDEN("E005", "Access denied"),
    BAD_REQUEST("E006", "Bad request"),

    // ==================== Auth ====================
    AUTH_INVALID_CREDENTIALS("E100", "Invalid email or password"),
    AUTH_TOKEN_EXPIRED("E101", "Token has expired"),
    AUTH_TOKEN_INVALID("E102", "Invalid token"),
    AUTH_ACCOUNT_DISABLED("E103", "Account is disabled"),
    AUTH_GOOGLE_TOKEN_INVALID("E104", "Invalid Google token"),
    AUTH_GOOGLE_NOT_CONFIGURED("E105", "Google authentication is not configured"),

    // ==================== Shop ====================
    SHOP_NOT_FOUND("E200", "Shop not found"),
    SHOP_SLUG_EXISTS("E201", "Shop slug already exists"),
    SHOP_SUSPENDED("E202", "Shop is suspended"),
    SHOP_MAINTENANCE("E203", "Shop is currently in maintenance mode"),

    // ==================== User ====================
    USER_NOT_FOUND("E300", "User not found"),
    USER_EMAIL_EXISTS("E301", "Email already registered"),

    // ==================== Product ====================
    PRODUCT_NOT_FOUND("E400", "Product not found"),
    VARIANT_NOT_FOUND("E401", "Product variant not found"),
    VARIANT_OUT_OF_STOCK("E402", "Variant is out of stock"),

    // ==================== Order ====================
    ORDER_NOT_FOUND("E500", "Order not found"),
    ORDER_INVALID_STATUS("E501", "Invalid order status transition"),
    ORDER_CANNOT_CANCEL("E502", "Order cannot be cancelled"),

    // ==================== Rental ====================
    RENTAL_DATE_CONFLICT("E600", "Rental dates conflict with existing booking"),
    RENTAL_NOT_FOUND("E601", "Rental detail not found"),
    RENTAL_ALREADY_RETURNED("E602", "Rental already returned");

    private final String code;
    private final String message;

    ErrorCode(String code, String message) {
        this.code = code;
        this.message = message;
    }
}

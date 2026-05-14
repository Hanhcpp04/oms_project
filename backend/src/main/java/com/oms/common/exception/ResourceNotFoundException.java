package com.oms.common.exception;

/**
 * Exception for resource not found (HTTP 404).
 */
public class ResourceNotFoundException extends BusinessException {

    public ResourceNotFoundException(String resourceName, Long id) {
        super(ErrorCode.RESOURCE_NOT_FOUND,
                String.format("%s not found with id: %d", resourceName, id));
    }

    public ResourceNotFoundException(String resourceName, String field, String value) {
        super(ErrorCode.RESOURCE_NOT_FOUND,
                String.format("%s not found with %s: %s", resourceName, field, value));
    }
}

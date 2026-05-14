package com.oms.module.user.dto;

import lombok.Data;

import java.util.List;

/**
 * Request to update a staff member's permissions.
 */
@Data
public class UpdatePermissionsRequest {
    private List<String> permissionCodes;
}

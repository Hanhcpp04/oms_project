package com.oms.module.shop.dto;

import lombok.Data;

@Data
public class ShopOperationalSettingsRequest {
    private Boolean autoAcceptOrders;
    private Boolean maintenanceMode;
    private Boolean showInventoryOnStorefront;
    private Boolean notificationsEnabled;
    private Boolean rentalIdentityVerificationEnabled;
}

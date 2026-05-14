package com.oms.module.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@Builder
public class AuthShopDto {

    private Long id;
    private String name;
    private String slug;
    private String avatarUrl;
    private String email;
    private String phone;
    private String supportEmail;
    private String supportPhone;
    private String businessMode;
    private String status;
    private Boolean enableSell;
    private Boolean enableRent;
    private Boolean autoAcceptOrders;
    private Boolean maintenanceMode;
    private Boolean showInventoryOnStorefront;
    private Boolean notificationsEnabled;
    private Boolean rentalIdentityVerificationEnabled;
    private List<String> categories;
    private List<ShopAddressDto> addresses;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ShopAddressDto {
        private Long id;
        private String label;
        private String addressLine;
        private String ward;
        private String district;
        private String province;
        private Boolean isDefault;
    }
}

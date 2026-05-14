package com.oms.module.shop.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateShopProfileRequest {
    private String name;
    private String email;
    private String phone;
    private String supportEmail;
    private String supportPhone;
    private String logoUrl;
    private List<ShopAddressDto> addresses;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ShopAddressDto {
        private Long id; // Optional, for updates
        private String label;
        private String addressLine;
        private String ward;
        private String district;
        private String province;
        private Boolean isDefault;
    }
}

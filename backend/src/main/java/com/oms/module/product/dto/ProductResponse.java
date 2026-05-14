package com.oms.module.product.dto;

import com.oms.module.product.entity.ProductType;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class ProductResponse {

    private Long id;
    private String name;
    private String description;
    private String categoryName;
    private ProductType productType;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private List<VariantResponse> variants;
    private List<ImageResponse> images;
    private List<CustomAttributeResponse> customAttributes;

    @Getter
    @Builder
    public static class VariantResponse {
        private Long id;
        private String size;
        private String color;
        private Integer stockQty;
        private BigDecimal priceSell;
        private BigDecimal priceRentPerDay;
        private BigDecimal depositAmount;
        private Boolean isActive;
    }

    @Getter
    @Builder
    public static class ImageResponse {
        private Long id;
        private String url;
        private String altText;
        private Integer sortOrder;
    }

    @Getter
    @Builder
    public static class CustomAttributeResponse {
        private Long id;
        private Long fieldId;
        private String fieldKey;
        private String label;
        private String value;
    }
}

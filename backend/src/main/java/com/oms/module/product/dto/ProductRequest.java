package com.oms.module.product.dto;

import com.oms.module.product.entity.ProductType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
public class ProductRequest {

    @NotBlank(message = "Product name is required")
    @Size(max = 200)
    private String name;

    private String description;

    @NotNull(message = "Product type is required")
    private ProductType productType;

    private String categoryName;

    private List<VariantRequest> variants;
    private List<String> imageUrls;
    private List<CustomAttributeRequest> customAttributes;

    @Getter
    @Setter
    public static class VariantRequest {
        private Long id;
        private String size;
        private String color;
        private Integer stockQty;
        private BigDecimal priceSell;
        private BigDecimal priceRentPerDay;
        private BigDecimal depositAmount;
    }

    @Getter
    @Setter
    public static class CustomAttributeRequest {
        private Long fieldId;
        private String value;
    }
}

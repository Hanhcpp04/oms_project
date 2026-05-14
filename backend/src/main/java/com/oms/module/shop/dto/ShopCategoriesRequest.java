package com.oms.module.shop.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;
import java.util.List;

@Data
public class ShopCategoriesRequest {
    @NotEmpty(message = "Categories list cannot be empty")
    private List<String> categories;
}

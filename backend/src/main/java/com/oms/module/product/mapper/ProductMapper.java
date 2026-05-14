package com.oms.module.product.mapper;

import com.oms.module.product.dto.ProductResponse;
import com.oms.module.product.entity.Product;
import com.oms.module.product.entity.ProductImage;
import com.oms.module.product.entity.ProductVariant;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

import java.util.List;

/**
 * MapStruct mapper for Product entity ↔ DTO conversions.
 * Spring will auto-create an implementation at compile time.
 */
@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface ProductMapper {

    @Mapping(target = "customAttributes", source = "customAttributeValues")
    @Mapping(target = "categoryName", source = "category.name")
    ProductResponse toResponse(Product product);

    List<ProductResponse> toResponseList(List<Product> products);

    ProductResponse.VariantResponse toVariantResponse(ProductVariant variant);

    ProductResponse.ImageResponse toImageResponse(ProductImage image);

    @Mapping(target = "fieldId", source = "field.id")
    @Mapping(target = "fieldKey", source = "fieldKeySnapshot")
    @Mapping(target = "label", source = "labelSnapshot")
    @Mapping(target = "value", source = "valueJson")
    ProductResponse.CustomAttributeResponse toCustomAttributeResponse(com.oms.module.product.entity.ProductCustomAttributeValue value);
}

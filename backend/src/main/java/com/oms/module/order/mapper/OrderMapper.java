package com.oms.module.order.mapper;

import com.oms.module.order.dto.OrderResponse;
import com.oms.module.order.entity.Order;
import com.oms.module.order.entity.OrderCustomFieldValue;
import com.oms.module.order.entity.OrderItem;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;
import org.mapstruct.ReportingPolicy;

import java.math.BigDecimal;
import java.util.List;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface OrderMapper {

    @Mapping(target = "rentalInfo", ignore = true)
    @Mapping(target = "customFieldValues", source = "customFieldValues")
    @Mapping(target = "items", source = "items")
    @Mapping(target = "createdByFullName", source = "createdBy.fullName")
    @Mapping(target = "createdByUsername", source = "createdBy.username")
    OrderResponse toResponse(Order order);

    List<OrderResponse> toResponseList(List<Order> orders);

    @Mapping(target = "variantId", source = "variant.id")
    @Mapping(target = "productId", source = "product.id")
    @Mapping(target = "productImageSnapshot", expression = "java(getFallbackImage(item))")
    @Mapping(target = "categoryNameSnapshot", expression = "java(getFallbackCategory(item))")
    OrderResponse.ItemResponse toItemResponse(OrderItem item);

    default String getFallbackImage(OrderItem item) {
        if (org.springframework.util.StringUtils.hasText(item.getProductImageSnapshot())) {
            return item.getProductImageSnapshot();
        }
        if (item.getProduct() != null && !item.getProduct().getImages().isEmpty()) {
            return item.getProduct().getImages().get(0).getUrl();
        }
        return null;
    }

    default String getFallbackCategory(OrderItem item) {
        if (org.springframework.util.StringUtils.hasText(item.getCategoryNameSnapshot())) {
            return item.getCategoryNameSnapshot();
        }
        if (item.getProduct() != null && item.getProduct().getCategory() != null) {
            return item.getProduct().getCategory().getName();
        }
        return null;
    }

    @Mapping(target = "fieldId", source = "fieldId")
    OrderResponse.CustomFieldValueResponse toCustomFieldValueResponse(OrderCustomFieldValue cfv);
}

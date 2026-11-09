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

    @Mapping(target = "rentalInfo", expression = "java(toRentalInfo(order))")
    @Mapping(target = "customFieldValues", source = "customFieldValues")
    @Mapping(target = "items", source = "items")
    @Mapping(target = "createdByFullName", source = "createdBy.fullName")
    @Mapping(target = "createdByUsername", source = "createdBy.username")
    @Mapping(target = "fulfillmentStatus", expression = "java(resolveFulfillmentStatus(order))")
    @Mapping(target = "source", expression = "java(order.getSourceMethod() != null ? order.getSourceMethod().name() : order.getSourceChannel())")
    @Mapping(target = "messenger", expression = "java(toMessengerInfo(order))")
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

    default OrderResponse.MessengerInfo toMessengerInfo(Order order) {
        if (order == null || !org.springframework.util.StringUtils.hasText(order.getMessengerPageId())) {
            return null;
        }
        return OrderResponse.MessengerInfo.builder()
                .pageId(order.getMessengerPageId())
                .customerPsid(order.getMessengerCustomerPsid())
                .conversationId(order.getMessengerConversationId())
                .draftId(order.getMessengerDraftId())
                .build();
    }

    default String resolveFulfillmentStatus(Order order) {
        if (order == null || order.getStatus() == null) {
            return null;
        }
        return switch (order.getStatus()) {
            case NEW, PENDING -> "PENDING_CONFIRMATION";
            case CONFIRMED -> order.getOrderType() == Order.OrderType.RENT ? "READY_TO_RENT" : "READY_TO_PACK";
            case PACKING -> "PACKING";
            case SHIPPED -> "SHIPPED";
            case DONE -> "DONE";
            case CANCELLED -> "CANCELLED";
            case DEPOSITED -> "DEPOSITED";
            case RENTING -> "RENTING";
            case OVERDUE -> "OVERDUE";
            case RETURNED -> "RETURNED";
            case PAID -> "PAID";
        };
    }

    default OrderResponse.RentalInfo toRentalInfo(Order order) {
        if (order == null || order.getOrderType() != Order.OrderType.RENT) {
            return null;
        }
        return OrderResponse.RentalInfo.builder()
                .rentFrom(order.getRentFrom())
                .rentTo(order.getRentTo())
                .depositPaid(order.getDepositAmount())
                .build();
    }
}

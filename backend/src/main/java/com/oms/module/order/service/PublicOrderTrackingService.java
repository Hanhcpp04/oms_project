package com.oms.module.order.service;

import com.oms.common.exception.ResourceNotFoundException;
import com.oms.module.order.dto.PublicOrderTrackingResponse;
import com.oms.module.order.entity.Order;
import com.oms.module.order.entity.OrderItem;
import com.oms.module.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class PublicOrderTrackingService {

    private final OrderRepository orderRepository;
    private final PublicOrderTrackingTokenService tokenService;

    @Transactional(readOnly = true)
    public PublicOrderTrackingResponse getByToken(String token) {
        PublicOrderTrackingTokenService.TrackingTokenPayload payload = tokenService.parseToken(token)
                .orElseThrow(this::trackingNotFound);

        Order order = orderRepository.findById(payload.orderId())
                .orElseThrow(this::trackingNotFound);

        if (!Objects.equals(order.getOrderCode(), payload.orderCode())) {
            throw trackingNotFound();
        }

        return toResponse(order);
    }

    private PublicOrderTrackingResponse toResponse(Order order) {
        return PublicOrderTrackingResponse.builder()
                .orderCode(order.getOrderCode())
                .orderType(order.getOrderType())
                .status(order.getStatus())
                .paymentStatus(order.getPaymentStatus())
                .paymentMethod(order.getPaymentMethod())
                .shopName(order.getShop() != null ? order.getShop().getName() : null)
                .shopLogoUrl(order.getShop() != null ? order.getShop().getLogoUrl() : null)
                .customerName(order.getCustomerName())
                .customerPhone(order.getCustomerPhone())
                .customerAddress(order.getCustomerAddress())
                .customerNote(order.getCustomerNote())
                .shippingMethod(order.getShippingMethod())
                .shippingFee(zeroIfNull(order.getShippingFee()))
                .totalAmount(zeroIfNull(order.getTotalAmount()))
                .depositAmount(order.getOrderType() == Order.OrderType.RENT ? zeroIfNull(order.getDepositAmount()) : null)
                .rentFrom(order.getOrderType() == Order.OrderType.RENT ? order.getRentFrom() : null)
                .rentTo(order.getOrderType() == Order.OrderType.RENT ? order.getRentTo() : null)
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .items(toItemResponses(order.getItems()))
                .build();
    }

    private List<PublicOrderTrackingResponse.ItemResponse> toItemResponses(List<OrderItem> items) {
        if (items == null) {
            return List.of();
        }

        return items.stream()
                .map(this::toItemResponse)
                .toList();
    }

    private PublicOrderTrackingResponse.ItemResponse toItemResponse(OrderItem item) {
        return PublicOrderTrackingResponse.ItemResponse.builder()
                .productName(item.getProductNameSnapshot())
                .productImageUrl(item.getProductImageSnapshot())
                .sku(item.getSkuSnapshot())
                .size(item.getVariantSizeSnapshot())
                .color(item.getVariantColorSnapshot())
                .quantity(item.getQuantity())
                .unitPrice(zeroIfNull(item.getUnitPrice()))
                .lineTotal(zeroIfNull(item.getLineTotal()))
                .build();
    }

    private BigDecimal zeroIfNull(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private ResourceNotFoundException trackingNotFound() {
        return new ResourceNotFoundException("Order", "trackingToken", "invalid");
    }
}

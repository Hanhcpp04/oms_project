package com.oms.module.messenger.service;

import com.oms.module.messenger.dto.OrderInfoExtractedDto;
import com.oms.module.messenger.entity.Message;
import com.oms.module.messenger.enums.MessageSenderType;
import com.oms.module.order.dto.AiParseRequest;
import com.oms.module.order.dto.AiParseResponse;
import com.oms.module.order.entity.Order;
import com.oms.module.order.service.OrderAiParseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
@Primary
@RequiredArgsConstructor
@Slf4j
public class GeminiMessengerOrderExtractionService implements OrderExtractionService {

    private final OrderAiParseService orderAiParseService;
    private final RuleBasedOrderExtractionService ruleBasedOrderExtractionService;

    @Override
    public OrderInfoExtractedDto extractOrderInfo(List<Message> messages, Long shopId) {
        OrderInfoExtractedDto ruleBased = ruleBasedOrderExtractionService.extractOrderInfo(messages, shopId);
        String rawText = buildRawText(messages);
        if (!StringUtils.hasText(rawText)) {
            return ruleBased;
        }

        try {
            AiParseRequest request = new AiParseRequest();
            request.setRawText(rawText);
            request.setOrderTypeHint(ruleBased.getOrderType());

            AiParseResponse aiResponse = orderAiParseService.parse(shopId, request);
            OrderInfoExtractedDto aiExtracted = toMessengerOrderInfo(aiResponse, ruleBased);
            log.debug("Extracted Messenger order info with Gemini-backed parser. shopId={}, missingFields={}",
                    shopId, aiExtracted.getMissingFields());
            return aiExtracted;
        } catch (Exception ex) {
            log.warn("Gemini-backed Messenger extraction failed. Falling back to rule-based parser. reason={}",
                    ex.getMessage());
            return ruleBased;
        }
    }

    private String buildRawText(List<Message> messages) {
        if (messages == null || messages.isEmpty()) {
            return "";
        }

        return messages.stream()
                .filter(Objects::nonNull)
                .filter(message -> message.getSenderType() == null || message.getSenderType() != MessageSenderType.SYSTEM)
                .map(Message::getText)
                .filter(StringUtils::hasText)
                .map(String::trim)
                .reduce((left, right) -> left + "\n" + right)
                .orElse("");
    }

    private OrderInfoExtractedDto toMessengerOrderInfo(
            AiParseResponse aiResponse,
            OrderInfoExtractedDto fallback
    ) {
        if (aiResponse == null) {
            return fallback;
        }

        AiParseResponse.ProductDraft product = firstProduct(aiResponse);
        List<OrderInfoExtractedDto.ItemDto> items = mapItems(aiResponse, fallback);
        String productName = firstNonBlank(product != null ? product.getName() : null, fallback.getProductName());
        Integer quantity = product != null && product.getQuantity() != null ? product.getQuantity() : fallback.getQuantity();
        String size = firstNonBlank(product != null ? product.getSize() : null, fallback.getSize());

        var price = product != null && product.getUnitPrice() != null
                ? product.getUnitPrice()
                : fallback.getPrice();
        LocalDate rentFrom = parseDate(firstNonBlank(aiResponse.getRentFrom(), fallback.getRentFrom() != null ? fallback.getRentFrom().toString() : null));
        LocalDate rentTo = parseDate(firstNonBlank(aiResponse.getRentTo(), fallback.getRentTo() != null ? fallback.getRentTo().toString() : null));

        List<String> missingFields = findMissingFields(
                productName,
                quantity,
                firstNonBlank(aiResponse.getCustomerPhone(), fallback.getPhone()),
                firstNonBlank(aiResponse.getCustomerAddress(), fallback.getAddress()),
                aiResponse.getOrderType() != null ? aiResponse.getOrderType() : fallback.getOrderType(),
                fallback.getRentalDays(),
                rentFrom,
                rentTo
        );

        return OrderInfoExtractedDto.builder()
                .customerName(firstNonBlank(aiResponse.getCustomerName(), fallback.getCustomerName()))
                .phone(firstNonBlank(aiResponse.getCustomerPhone(), fallback.getPhone()))
                .address(firstNonBlank(aiResponse.getCustomerAddress(), fallback.getAddress()))
                .orderType(aiResponse.getOrderType() != null ? aiResponse.getOrderType() : fallback.getOrderType())
                .productId(product != null && product.getProductId() != null ? product.getProductId() : fallback.getProductId())
                .variantId(product != null && product.getVariantId() != null ? product.getVariantId() : fallback.getVariantId())
                .productName(productName)
                .productCode(firstNonBlank(product != null ? product.getProductCode() : null, fallback.getProductCode()))
                .sku(firstNonBlank(product != null ? product.getSku() : null, fallback.getSku()))
                .quantity(quantity)
                .color(firstNonBlank(product != null ? product.getColor() : null, fallback.getColor()))
                .size(size)
                .price(price)
                .depositAmount(aiResponse.getDepositPaid() != null ? aiResponse.getDepositPaid() : fallback.getDepositAmount())
                .rentalDays(fallback.getRentalDays())
                .deliveryDate(rentFrom != null ? rentFrom : fallback.getDeliveryDate())
                .rentFrom(rentFrom)
                .rentTo(rentTo)
                .confidence(0.86)
                .note(firstNonBlank(aiResponse.getCustomerNote(), fallback.getNote()))
                .missingFields(missingFields)
                .items(items)
                .build();
    }

    private AiParseResponse.ProductDraft firstProduct(AiParseResponse aiResponse) {
        if (aiResponse.getProducts() == null || aiResponse.getProducts().isEmpty()) {
            return null;
        }
        return aiResponse.getProducts().stream()
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    private List<OrderInfoExtractedDto.ItemDto> mapItems(
            AiParseResponse aiResponse,
            OrderInfoExtractedDto fallback
    ) {
        if (aiResponse.getProducts() != null && !aiResponse.getProducts().isEmpty()) {
            return aiResponse.getProducts().stream()
                    .filter(Objects::nonNull)
                    .filter(product -> StringUtils.hasText(product.getName()))
                    .map(product -> OrderInfoExtractedDto.ItemDto.builder()
                            .productId(product.getProductId() != null ? product.getProductId() : fallback.getProductId())
                            .variantId(product.getVariantId() != null ? product.getVariantId() : fallback.getVariantId())
                            .productName(product.getName())
                            .productCode(firstNonBlank(product.getProductCode(), fallback.getProductCode()))
                            .sku(firstNonBlank(product.getSku(), fallback.getSku()))
                            .variant(product.getSize())
                            .size(product.getSize())
                            .color(firstNonBlank(product.getColor(), fallback.getColor()))
                            .quantity(product.getQuantity())
                            .rentalDays(fallback.getRentalDays())
                            .price(product.getUnitPrice())
                            .deposit(aiResponse.getDepositPaid())
                            .build())
                    .toList();
        }

        if (fallback.getItems() != null && !fallback.getItems().isEmpty()) {
            return fallback.getItems();
        }

        if (!StringUtils.hasText(fallback.getProductName())) {
            return List.of();
        }

        return List.of(OrderInfoExtractedDto.ItemDto.builder()
                .productId(fallback.getProductId())
                .variantId(fallback.getVariantId())
                .productName(fallback.getProductName())
                .productCode(fallback.getProductCode())
                .sku(fallback.getSku())
                .variant(fallback.getSize())
                .size(fallback.getSize())
                .color(fallback.getColor())
                .quantity(fallback.getQuantity())
                .rentalDays(fallback.getRentalDays())
                .price(fallback.getPrice())
                .deposit(fallback.getDepositAmount())
                .build());
    }

    private List<String> findMissingFields(
            String productName,
            Integer quantity,
            String phone,
            String address,
            Order.OrderType orderType,
            Integer rentalDays,
            LocalDate rentFrom,
            LocalDate rentTo
    ) {
        List<String> missingFields = new ArrayList<>();
        if (!StringUtils.hasText(productName)) {
            missingFields.add("productName");
        }
        if (quantity == null) {
            missingFields.add("quantity");
        }
        if (!StringUtils.hasText(phone)) {
            missingFields.add("phone");
        }
        if (!StringUtils.hasText(address)) {
            missingFields.add("address");
        }
        if (orderType == null) {
            missingFields.add("orderType");
        }
        if (orderType == Order.OrderType.RENT) {
            if (rentalDays == null && (rentFrom == null || rentTo == null)) {
                missingFields.add("rentalDays");
            }
            if (rentFrom == null || rentTo == null) {
                missingFields.add("rentDates");
            }
        }
        return missingFields;
    }

    private LocalDate parseDate(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (Exception ignored) {
            return null;
        }
    }

    private String firstNonBlank(String first, String second) {
        return StringUtils.hasText(first) ? first.trim() : second;
    }
}

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
            request.setOrderTypeHint(Order.OrderType.SELL);

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
                .filter(message -> message.getSenderType() == null || message.getSenderType() == MessageSenderType.CUSTOMER)
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
        String productName = firstNonBlank(product != null ? product.getName() : null, fallback.getProductName());
        Integer quantity = product != null && product.getQuantity() != null ? product.getQuantity() : fallback.getQuantity();
        String size = firstNonBlank(product != null ? product.getSize() : null, fallback.getSize());

        var price = product != null && product.getUnitPrice() != null
                ? product.getUnitPrice()
                : fallback.getPrice();

        List<String> missingFields = findMissingFields(
                productName,
                quantity,
                firstNonBlank(aiResponse.getCustomerPhone(), fallback.getPhone()),
                firstNonBlank(aiResponse.getCustomerAddress(), fallback.getAddress())
        );

        return OrderInfoExtractedDto.builder()
                .customerName(firstNonBlank(aiResponse.getCustomerName(), fallback.getCustomerName()))
                .phone(firstNonBlank(aiResponse.getCustomerPhone(), fallback.getPhone()))
                .address(firstNonBlank(aiResponse.getCustomerAddress(), fallback.getAddress()))
                .productName(productName)
                .productCode(fallback.getProductCode())
                .quantity(quantity)
                .color(fallback.getColor())
                .size(size)
                .price(price)
                .note(firstNonBlank(aiResponse.getCustomerNote(), fallback.getNote()))
                .missingFields(missingFields)
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

    private List<String> findMissingFields(String productName, Integer quantity, String phone, String address) {
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
        return missingFields;
    }

    private String firstNonBlank(String first, String second) {
        return StringUtils.hasText(first) ? first.trim() : second;
    }
}

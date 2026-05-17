package com.oms.module.payment.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.common.exception.ResourceNotFoundException;
import com.oms.config.PayosProperties;
import com.oms.module.order.entity.Order;
import com.oms.module.order.entity.OrderItem;
import com.oms.module.order.repository.OrderRepository;
import com.oms.module.order.service.OrderService;
import com.oms.module.payment.dto.PaymentCheckoutResponse;
import com.oms.module.payment.entity.Payment;
import com.oms.module.payment.payos.PayosApiResponse;
import com.oms.module.payment.payos.PayosClient;
import com.oms.module.payment.payos.PayosCreatePaymentData;
import com.oms.module.payment.payos.PayosCreatePaymentRequest;
import com.oms.module.payment.payos.PayosSignature;
import com.oms.module.payment.payos.PayosWebhookRequest;
import com.oms.module.payment.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    private static final String VND = "VND";
    private static final List<Payment.Status> REUSABLE_STATUSES = List.of(Payment.Status.PENDING);
    private static final DateTimeFormatter PAYOS_WEBHOOK_DATE_TIME =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final PayosClient payosClient;
    private final PayosProperties payosProperties;
    private final ObjectMapper objectMapper;
    private final OrderService orderService;

    public boolean canCreatePayosCheckout() {
        return payosProperties.isConfigured();
    }

    @Transactional
    public PaymentCheckoutResponse createPayosCheckout(Long shopId, Long orderId) {
        return createPayosCheckout(shopId, orderId, Payment.Purpose.ORDER_FULL);
    }

    @Transactional
    public PaymentCheckoutResponse createPayosCheckout(Long shopId, Long orderId, Payment.Purpose purpose) {
        Order order = orderRepository.findByIdAndShopId(orderId, shopId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));
        return createPayosCheckout(order, purpose);
    }

    @Transactional
    public PaymentCheckoutResponse createPayosCheckout(Order order) {
        return createPayosCheckout(order, Payment.Purpose.ORDER_FULL);
    }

    @Transactional
    public PaymentCheckoutResponse createPayosCheckout(Order order, Payment.Purpose purpose) {
        if (order == null || order.getId() == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Order must be saved before creating payment");
        }

        if (order.getPaymentMethod() != Order.PaymentMethod.BANK_TRANSFER) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "payOS checkout is only available for bank transfer orders");
        }

        PaymentCheckoutResponse existingCheckout = paymentRepository
                .findFirstByOrderIdAndProviderAndPurposeAndStatusInOrderByCreatedAtDesc(
                        order.getId(),
                        Payment.Provider.PAYOS,
                        resolvePurpose(purpose),
                        REUSABLE_STATUSES
                )
                .filter(payment -> StringUtils.hasText(payment.getCheckoutUrl()))
                .map(this::toCheckoutResponse)
                .orElse(null);

        if (existingCheckout != null) {
            return existingCheckout;
        }

        if (!payosProperties.isConfigured()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "payOS is not configured");
        }

        Payment.Purpose resolvedPurpose = resolvePurpose(purpose);
        BigDecimal amount = resolvePayableAmount(order, resolvedPurpose);
        Long amountLong = amount.longValueExact();
        Long providerOrderCode = generateProviderOrderCode();
        String description = buildDescription(order, resolvedPurpose);
        String returnUrl = payosProperties.getReturnUrl();
        String cancelUrl = payosProperties.getCancelUrl();
        String signature = PayosSignature.signCreatePayment(
                amountLong,
                cancelUrl,
                description,
                providerOrderCode,
                returnUrl,
                payosProperties.getChecksumKey()
        );

        PayosCreatePaymentRequest request = PayosCreatePaymentRequest.builder()
                .orderCode(providerOrderCode)
                .amount(amountLong)
                .description(description)
                .buyerName(order.getCustomerName())
                .buyerPhone(order.getCustomerPhone())
                .cancelUrl(cancelUrl)
                .returnUrl(returnUrl)
                .items(List.of(PayosCreatePaymentRequest.Item.builder()
                        .name(order.getOrderCode())
                        .quantity(1)
                        .price(amountLong)
                        .build()))
                .signature(signature)
                .build();

        PayosApiResponse<PayosCreatePaymentData> response = payosClient.createPaymentLink(request);
        if (!response.isSuccess() || response.getData() == null) {
            throw new BusinessException(
                    ErrorCode.BAD_REQUEST,
                    "payOS create payment failed: " + response.getDesc()
            );
        }

        Payment payment = buildPayment(order, resolvedPurpose, amount, response.getData(), providerOrderCode, description);
        return toCheckoutResponse(paymentRepository.save(payment));
    }

    @Transactional
    public void handlePayosWebhook(PayosWebhookRequest request) {
        if (request == null || request.getData() == null || !StringUtils.hasText(request.getSignature())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Invalid payOS webhook payload");
        }

        boolean validSignature = PayosSignature.verifyWebhookData(
                request.getData(),
                request.getSignature(),
                payosProperties.getChecksumKey(),
                objectMapper
        );
        if (!validSignature) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Invalid payOS webhook signature");
        }

        Long providerOrderCode = asLong(request.getData().get("orderCode"));
        String paymentLinkId = asString(request.getData().get("paymentLinkId"));

        Payment payment = findPayosPayment(providerOrderCode, paymentLinkId);
        if (payment == null) {
            log.warn("Received payOS webhook without local payment. orderCode={}, paymentLinkId={}",
                    providerOrderCode, paymentLinkId);
            return;
        }

        String payloadJson = writeWebhookPayload(request);
        payment.setWebhookPayloadJson(payloadJson);
        payment.setProviderStatus(asString(request.getData().get("code")));
        payment.setProviderReference(asString(request.getData().get("reference")));

        Long webhookAmount = asLong(request.getData().get("amount"));
        if (webhookAmount != null && payment.getAmount().compareTo(BigDecimal.valueOf(webhookAmount)) != 0) {
            payment.setStatus(Payment.Status.FAILED);
            payment.setFailureReason("Webhook amount does not match payment amount");
            throw new BusinessException(ErrorCode.BAD_REQUEST, "payOS webhook amount does not match payment amount");
        }

        if (Boolean.TRUE.equals(request.getSuccess())
                && "00".equals(request.getCode())
                && "00".equals(asString(request.getData().get("code")))) {
            markPaid(payment, request);
            return;
        }

        payment.setStatus(Payment.Status.FAILED);
        payment.setFailureReason(StringUtils.hasText(request.getDesc()) ? request.getDesc() : "payOS payment failed");
    }

    @Transactional(readOnly = true)
    public PaymentCheckoutResponse getLatestCheckout(Long orderId) {
        return paymentRepository.findFirstByOrderIdOrderByCreatedAtDesc(orderId)
                .map(this::toCheckoutResponse)
                .orElse(null);
    }

    public PaymentCheckoutResponse toCheckoutResponse(Payment payment) {
        if (payment == null) {
            return null;
        }

        return PaymentCheckoutResponse.builder()
                .paymentId(payment.getId())
                .provider(payment.getProvider() != null ? payment.getProvider().name() : null)
                .method(payment.getMethod() != null ? payment.getMethod().name() : null)
                .purpose(payment.getPurpose() != null ? payment.getPurpose().name() : null)
                .status(payment.getStatus() != null ? payment.getStatus().name() : null)
                .providerOrderCode(payment.getProviderOrderCode())
                .providerPaymentLinkId(payment.getProviderPaymentLinkId())
                .amount(payment.getAmount())
                .currency(payment.getCurrency())
                .description(payment.getDescription())
                .checkoutUrl(payment.getCheckoutUrl())
                .qrCode(payment.getQrCode())
                .qrImageUrl(payment.getQrImageUrl())
                .build();
    }

    private Payment buildPayment(
            Order order,
            Payment.Purpose purpose,
            BigDecimal amount,
            PayosCreatePaymentData data,
            Long providerOrderCode,
            String fallbackDescription
    ) {
        return Payment.builder()
                .order(order)
                .provider(Payment.Provider.PAYOS)
                .method(Payment.Method.BANK_TRANSFER)
                .purpose(resolvePurpose(purpose))
                .status(resolveInitialStatus(data.getStatus()))
                .amount(amount)
                .currency(StringUtils.hasText(data.getCurrency()) ? data.getCurrency() : VND)
                .providerOrderCode(data.getOrderCode() != null ? data.getOrderCode() : providerOrderCode)
                .providerPaymentLinkId(data.getPaymentLinkId())
                .checkoutUrl(data.getCheckoutUrl())
                .qrCode(data.getQrCode())
                .qrImageUrl(buildQrImageUrl(data))
                .description(StringUtils.hasText(data.getDescription()) ? data.getDescription() : fallbackDescription)
                .providerStatus(data.getStatus())
                .build();
    }

    private Payment.Status resolveInitialStatus(String providerStatus) {
        if (!StringUtils.hasText(providerStatus)) {
            return Payment.Status.PENDING;
        }

        return switch (providerStatus.toUpperCase(Locale.ROOT)) {
            case "PAID" -> Payment.Status.PAID;
            case "CANCELLED" -> Payment.Status.CANCELLED;
            case "EXPIRED" -> Payment.Status.EXPIRED;
            default -> Payment.Status.PENDING;
        };
    }

    private void markPaid(Payment payment, PayosWebhookRequest request) {
        if (payment.getStatus() == Payment.Status.PAID) {
            return;
        }

        payment.setStatus(Payment.Status.PAID);
        payment.setPaidAt(parsePayosTransactionTime(asString(request.getData().get("transactionDateTime"))));

        Order order = payment.getOrder();
        order.setPaymentMethod(Order.PaymentMethod.BANK_TRANSFER);
        if (payment.getPurpose() == Payment.Purpose.RENTAL_DEPOSIT) {
            order.setPaymentStatus(Order.PaymentStatus.DEPOSITED);
        } else {
            order.setPaymentStatus(Order.PaymentStatus.PAID);
        }
        advanceOrderAfterSuccessfulPayment(order, payment.getPurpose());
    }

    private Payment findPayosPayment(Long providerOrderCode, String paymentLinkId) {
        if (providerOrderCode != null) {
            return paymentRepository.findByProviderAndProviderOrderCode(Payment.Provider.PAYOS, providerOrderCode)
                    .orElse(null);
        }

        if (StringUtils.hasText(paymentLinkId)) {
            return paymentRepository.findByProviderAndProviderPaymentLinkId(Payment.Provider.PAYOS, paymentLinkId)
                    .orElse(null);
        }

        return null;
    }

    private BigDecimal resolvePayableAmount(Order order, Payment.Purpose purpose) {
        BigDecimal amount = purpose == Payment.Purpose.RENTAL_DEPOSIT
                ? resolveRentalDepositAmount(order)
                : order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO;
        amount = amount.setScale(0, RoundingMode.HALF_UP);
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Order amount must be greater than 0");
        }
        return amount;
    }

    private BigDecimal resolveRentalDepositAmount(Order order) {
        if (order.getOrderType() != Order.OrderType.RENT) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Rental deposit payment is only available for rental orders");
        }

        if (order.getItems() == null || order.getItems().isEmpty()) {
            return BigDecimal.ZERO;
        }

        return order.getItems().stream()
                .map(this::resolveItemDepositAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal resolveItemDepositAmount(OrderItem item) {
        if (item == null || item.getVariant() == null || item.getVariant().getDepositAmount() == null) {
            return BigDecimal.ZERO;
        }

        int quantity = item.getQuantity() != null && item.getQuantity() > 0 ? item.getQuantity() : 1;
        return item.getVariant().getDepositAmount().multiply(BigDecimal.valueOf(quantity));
    }

    private Long generateProviderOrderCode() {
        for (int attempt = 0; attempt < 5; attempt++) {
            long candidate = (System.currentTimeMillis() / 1000L) * 100L
                    + ThreadLocalRandom.current().nextLong(10, 100);
            if (paymentRepository.findByProviderAndProviderOrderCode(Payment.Provider.PAYOS, candidate).isEmpty()) {
                return candidate;
            }
        }

        throw new BusinessException(ErrorCode.BAD_REQUEST, "Cannot generate unique payOS order code");
    }

    private String buildDescription(Order order, Payment.Purpose purpose) {
        String suffix = order.getId() != null ? String.valueOf(order.getId()) : String.valueOf(System.currentTimeMillis());
        String prefix = purpose == Payment.Purpose.RENTAL_DEPOSIT ? "COC" : "OMS";
        String description = prefix + suffix.replaceAll("\\D", "");
        return description.length() <= 9 ? description : description.substring(0, 9);
    }

    private Payment.Purpose resolvePurpose(Payment.Purpose purpose) {
        return purpose != null ? purpose : Payment.Purpose.ORDER_FULL;
    }

    private void advanceOrderAfterSuccessfulPayment(Order order, Payment.Purpose purpose) {
        if (order == null || order.getId() == null || order.getShop() == null || order.getShop().getId() == null) {
            return;
        }

        if (order.getStatus() == Order.OrderStatus.CANCELLED
                || order.getStatus() == Order.OrderStatus.DONE
                || order.getStatus() == Order.OrderStatus.RETURNED) {
            log.warn("Payment succeeded but order is terminal. orderId={}, status={}", order.getId(), order.getStatus());
            return;
        }

        try {
            ensureConfirmed(order);
            if (purpose == Payment.Purpose.RENTAL_DEPOSIT && order.getStatus() != Order.OrderStatus.DEPOSITED) {
                orderService.updateStatus(order.getShop().getId(), order.getId(), Order.OrderStatus.DEPOSITED, null);
            }
        } catch (RuntimeException ex) {
            log.warn("Payment succeeded but order status could not be advanced. orderId={}, purpose={}, reason={}",
                    order.getId(), purpose, ex.getMessage());
            throw ex;
        }
    }

    private void ensureConfirmed(Order order) {
        if (order.getStatus() == Order.OrderStatus.PENDING || order.getStatus() == Order.OrderStatus.NEW) {
            orderService.updateStatus(order.getShop().getId(), order.getId(), Order.OrderStatus.CONFIRMED, null);
        }
    }

    private String buildQrImageUrl(PayosCreatePaymentData data) {
        if (!StringUtils.hasText(data.getBin()) || !StringUtils.hasText(data.getAccountNumber())) {
            return null;
        }

        String accountName = encode(data.getAccountName());
        String addInfo = encode(data.getDescription());
        Long amount = data.getAmount();
        String amountParam = amount != null && amount > 0 ? "&amount=" + amount : "";

        return "https://img.vietqr.io/image/"
                + encodePath(data.getBin())
                + "-"
                + encodePath(data.getAccountNumber())
                + "-compact.png?accountName="
                + accountName
                + amountParam
                + "&addInfo="
                + addInfo;
    }

    private String encode(String value) {
        return URLEncoder.encode(value != null ? value : "", StandardCharsets.UTF_8);
    }

    private String encodePath(String value) {
        return URLEncoder.encode(value != null ? value : "", StandardCharsets.UTF_8).replace("+", "%20");
    }

    private Long asLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }

        if (value instanceof String string && StringUtils.hasText(string)) {
            try {
                return Long.parseLong(string);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }

        return null;
    }

    private String asString(Object value) {
        return value != null ? String.valueOf(value) : null;
    }

    private LocalDateTime parsePayosTransactionTime(String value) {
        if (!StringUtils.hasText(value)) {
            return LocalDateTime.now();
        }

        try {
            return LocalDateTime.parse(value, PAYOS_WEBHOOK_DATE_TIME);
        } catch (RuntimeException ignored) {
            return LocalDateTime.now();
        }
    }

    private String writeWebhookPayload(PayosWebhookRequest request) {
        try {
            return objectMapper.writeValueAsString(request);
        } catch (JsonProcessingException ex) {
            return null;
        }
    }
}

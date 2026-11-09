package com.oms.module.payment.payos;

import com.oms.common.exception.BusinessException;
import com.oms.common.exception.ErrorCode;
import com.oms.config.PayosProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
@RequiredArgsConstructor
public class PayosClient {

    private static final ParameterizedTypeReference<PayosApiResponse<PayosCreatePaymentData>> CREATE_PAYMENT_TYPE =
            new ParameterizedTypeReference<>() {
            };

    private final PayosProperties properties;

    public PayosApiResponse<PayosCreatePaymentData> createPaymentLink(PayosCreatePaymentRequest request) {
        try {
            PayosApiResponse<PayosCreatePaymentData> response = RestClient.builder()
                    .baseUrl(properties.getBaseUrl())
                    .build()
                    .post()
                    .uri("/v2/payment-requests")
                    .header("x-client-id", properties.getClientId())
                    .header("x-api-key", properties.getApiKey())
                    .body(request)
                    .retrieve()
                    .body(CREATE_PAYMENT_TYPE);

            if (response == null) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "payOS returned an empty response");
            }
            return response;
        } catch (RestClientResponseException ex) {
            throw new BusinessException(
                    ErrorCode.BAD_REQUEST,
                    "payOS create payment failed: " + ex.getResponseBodyAsString()
            );
        }
    }
}

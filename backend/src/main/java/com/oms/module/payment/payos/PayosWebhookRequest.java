package com.oms.module.payment.payos;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class PayosWebhookRequest {

    private String code;
    private String desc;
    private Boolean success;
    private Map<String, Object> data;
    private String signature;
}

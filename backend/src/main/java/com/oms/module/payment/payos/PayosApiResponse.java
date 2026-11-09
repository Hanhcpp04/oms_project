package com.oms.module.payment.payos;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class PayosApiResponse<T> {

    private String code;
    private String desc;
    private T data;
    private String signature;

    public boolean isSuccess() {
        return "00".equals(code);
    }
}

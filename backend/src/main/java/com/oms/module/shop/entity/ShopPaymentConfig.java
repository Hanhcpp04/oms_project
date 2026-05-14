package com.oms.module.shop.entity;

import com.oms.common.base.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * ShopPaymentConfig - stores payment method configurations for a shop.
 * OneToOne with Shop. Created lazily on first save.
 */
@Entity
@Table(name = "shop_payment_configs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShopPaymentConfig extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_id", nullable = false, unique = true)
    private Shop shop;

    // ===== COD =====
    @Column(name = "cod_enabled", nullable = false)
    @Builder.Default
    private Boolean codEnabled = false;

    // ===== Bank Transfer =====
    @Column(name = "bank_transfer_enabled", nullable = false)
    @Builder.Default
    private Boolean bankTransferEnabled = false;

    @Column(name = "bank_name", length = 100)
    private String bankName;

    @Column(name = "bank_code", length = 20)
    private String bankCode;

    @Column(name = "bank_account_number", length = 50)
    private String bankAccountNumber;

    @Column(name = "bank_account_name", length = 150)
    private String bankAccountName;

    // ===== VNPay (direction only — actual integration is future scope) =====
    @Column(name = "vnpay_enabled", nullable = false)
    @Builder.Default
    private Boolean vnpayEnabled = false;

    @Column(name = "vnpay_tmn_code", length = 50)
    private String vnpayTmnCode;

    @Column(name = "vnpay_hash_secret", length = 255)
    private String vnpayHashSecret;
}

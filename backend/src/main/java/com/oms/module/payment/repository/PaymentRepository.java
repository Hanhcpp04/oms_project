package com.oms.module.payment.repository;

import com.oms.module.payment.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {

    Optional<Payment> findFirstByOrderIdAndProviderAndStatusInOrderByCreatedAtDesc(
            Long orderId,
            Payment.Provider provider,
            Collection<Payment.Status> statuses
    );

    Optional<Payment> findFirstByOrderIdAndProviderAndPurposeAndStatusInOrderByCreatedAtDesc(
            Long orderId,
            Payment.Provider provider,
            Payment.Purpose purpose,
            Collection<Payment.Status> statuses
    );

    Optional<Payment> findFirstByOrderIdOrderByCreatedAtDesc(Long orderId);

    Optional<Payment> findByProviderAndProviderOrderCode(Payment.Provider provider, Long providerOrderCode);

    Optional<Payment> findByProviderAndProviderPaymentLinkId(Payment.Provider provider, String providerPaymentLinkId);
}

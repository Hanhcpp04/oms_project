package com.oms.module.rental.repository;

import com.oms.module.rental.entity.RentalAvailability;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface RentalAvailabilityRepository extends JpaRepository<RentalAvailability, Long> {

    @Query("SELECT ra FROM RentalAvailability ra " +
           "WHERE ra.variant.id = :variantId AND ra.isActive = true " +
           "AND ra.startDate <= :endDate AND ra.endDate >= :startDate")
    List<RentalAvailability> findConflicts(@Param("variantId") Long variantId,      
                                           @Param("startDate") LocalDate startDate,
                                           @Param("endDate") LocalDate endDate);

    List<RentalAvailability> findByVariantIdAndIsActiveTrue(Long variantId);

    @Query("SELECT ra FROM RentalAvailability ra " +
           "WHERE ra.variant.id = :variantId AND ra.isActive = true " +
           "AND ra.endDate >= :fromDate")
    List<RentalAvailability> findActiveBlocksFromDate(@Param("variantId") Long variantId,
                                                      @Param("fromDate") LocalDate fromDate);

    @Query("SELECT ra FROM RentalAvailability ra " +
           "JOIN FETCH ra.variant v " +
           "JOIN FETCH v.product p " +
           "LEFT JOIN FETCH ra.order o " +
           "WHERE p.shop.id = :shopId " +
           "AND (:productId IS NULL OR p.id = :productId) " +
           "AND (:variantId IS NULL OR v.id = :variantId) " +
           "AND ra.isActive = true " +
           "AND ra.startDate <= :endDate AND ra.endDate >= :startDate " +
           "ORDER BY ra.startDate ASC")
    List<RentalAvailability> findActiveBlocksForShop(
            @Param("shopId") Long shopId,
            @Param("productId") Long productId,
            @Param("variantId") Long variantId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    List<RentalAvailability> findByOrderIdAndIsActiveTrue(Long orderId);
}

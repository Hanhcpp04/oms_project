package com.oms.module.user.repository;

import com.oms.module.user.entity.WorkShift;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Repository
public interface WorkShiftRepository extends JpaRepository<WorkShift, Long> {

    List<WorkShift> findByShopIdAndShiftDateBetweenOrderByShiftDateAscStartTimeAsc(Long shopId, LocalDate startDate, LocalDate endDate);

    @Query("SELECT CASE WHEN COUNT(s) > 0 THEN true ELSE false END " +
           "FROM WorkShift s " +
           "WHERE s.shop.id = :shopId " +
           "AND s.shiftDate = :shiftDate " +
           "AND (:shiftId IS NULL OR s.id != :shiftId) " +
           "AND (" +
           "  (s.startTime < :endTime AND s.endTime > :startTime) " +
           ")")
    boolean existsOverlappingShift(
            @Param("shopId") Long shopId,
            @Param("shiftDate") LocalDate shiftDate,
            @Param("startTime") LocalTime startTime,
            @Param("endTime") LocalTime endTime,
            @Param("shiftId") Long shiftId
    );
}

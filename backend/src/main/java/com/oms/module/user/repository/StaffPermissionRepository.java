package com.oms.module.user.repository;

import com.oms.module.user.entity.StaffPermission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StaffPermissionRepository extends JpaRepository<StaffPermission, Long> {

    List<StaffPermission> findByUserId(Long userId);

    @Query("SELECT sp.permission.code FROM StaffPermission sp WHERE sp.user.id = :userId")
    List<String> findPermissionCodesByUserId(@Param("userId") Long userId);

    boolean existsByUserIdAndPermissionCode(Long userId, String permissionCode);

    @Modifying
    void deleteByUserId(Long userId);

    @Modifying
    void deleteByUserIdAndPermissionId(Long userId, Long permissionId);
}

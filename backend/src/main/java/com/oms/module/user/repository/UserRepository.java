package com.oms.module.user.repository;

import com.oms.module.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByEmailOrUsername(String email, String username);

    boolean existsByEmail(String email);

    boolean existsByUsername(String username);

    Page<User> findByShopId(Long shopId, Pageable pageable);

    Page<User> findByShopIdAndFullNameContainingIgnoreCase(Long shopId, String fullName, Pageable pageable);

    Page<User> findByShopIdAndRole(Long shopId, User.UserRole role, Pageable pageable);

    Page<User> findByShopIdAndRoleAndFullNameContainingIgnoreCase(Long shopId, User.UserRole role, String fullName, Pageable pageable);
}

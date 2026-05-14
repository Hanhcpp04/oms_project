package com.oms.module.auth.repository;

import com.oms.module.auth.entity.RefreshToken;
import com.oms.module.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    List<RefreshToken> findAllByTokenHash(String tokenHash);

    void deleteByUser(User user);

    /**
     * Delete all expired or revoked refresh tokens.
     * Should be called periodically by a scheduled task to prevent table bloat.
     */
    @Modifying
    @Query("DELETE FROM RefreshToken t WHERE t.expiresAt < :now OR t.revokedAt IS NOT NULL")
    int deleteExpiredAndRevoked(@Param("now") LocalDateTime now);
}

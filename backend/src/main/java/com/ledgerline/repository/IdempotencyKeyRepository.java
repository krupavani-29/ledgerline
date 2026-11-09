package com.ledgerline.repository;

import com.ledgerline.model.IdempotencyKeyRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface IdempotencyKeyRepository extends JpaRepository<IdempotencyKeyRecord, Long> {

    Optional<IdempotencyKeyRecord> findByUserIdAndIdempotencyKey(Long userId, String idempotencyKey);

    // AGENTS.md Rule 5: Atomic key claim via single SQL statement (no check-then-insert race).
    // Compatible across PostgreSQL and H2 without throwing dialect syntax errors.
    @Modifying
    @Query(value = "INSERT INTO idempotency_keys (user_id, idempotency_key, request_hash, status_code, response_body, created_at) " +
                   "SELECT :userId, :key, :requestHash, :statusCode, :responseBody, NOW() " +
                   "WHERE NOT EXISTS (" +
                   "  SELECT 1 FROM idempotency_keys WHERE user_id = :userId AND idempotency_key = :key" +
                   ")", nativeQuery = true)
    int claimKey(
            @Param("userId") Long userId,
            @Param("key") String key,
            @Param("requestHash") String requestHash,
            @Param("statusCode") int statusCode,
            @Param("responseBody") String responseBody
    );
}

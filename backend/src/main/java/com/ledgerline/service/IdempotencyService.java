package com.ledgerline.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ledgerline.dto.TransactionReceipt;
import com.ledgerline.exception.IdempotencyConflictException;
import com.ledgerline.exception.InvalidTransactionException;
import com.ledgerline.model.IdempotencyKeyRecord;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;

@Service
public class IdempotencyService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public IdempotencyService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    // AGENTS.md Rule 5: Atomic key claim via single SQL statement (no check-then-insert race).
    // Using JdbcTemplate avoids Hibernate persistence context / rollback-only interference across threads.
    public boolean claimKey(Long userId, String idempotencyKey, String requestHash) {
        String sql = "INSERT INTO idempotency_keys (user_id, idempotency_key, request_hash, status_code, response_body, created_at) " +
                     "SELECT ?, ?, ?, 0, '', NOW() " +
                     "WHERE NOT EXISTS (" +
                     "  SELECT 1 FROM idempotency_keys WHERE user_id = ? AND idempotency_key = ?" +
                     ")";
        try {
            int rows = jdbcTemplate.update(sql, userId, idempotencyKey, requestHash, userId, idempotencyKey);
            return rows == 1;
        } catch (DataIntegrityViolationException e) {
            return false;
        }
    }

    public void recordSuccess(Long userId, String idempotencyKey, TransactionReceipt receipt) {
        try {
            String json = objectMapper.writeValueAsString(receipt);
            String sql = "UPDATE idempotency_keys SET status_code = 201, response_body = ? WHERE user_id = ? AND idempotency_key = ?";
            jdbcTemplate.update(sql, json, userId, idempotencyKey);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize transaction receipt", e);
        }
    }

    public TransactionReceipt handleExistingKey(Long userId, String idempotencyKey, String requestHash) {
        IdempotencyKeyRecord existing = findRecord(userId, idempotencyKey);
        if (existing == null) {
            throw new IdempotencyConflictException("Concurrent idempotency conflict");
        }

        if (!Objects.equals(existing.getRequestHash(), requestHash)) {
            // AGENTS.md Rule 5 & BRIEF.md M3: Same key + different payload => 422
            throw new IdempotencyConflictException("Idempotency key reused with different request payload");
        }

        // Wait if parallel request is currently being processed by winning thread
        if (existing.getStatusCode() == 0) {
            for (int i = 0; i < 100; i++) {
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Interrupted while waiting for concurrent idempotency transaction", e);
                }
                existing = findRecord(userId, idempotencyKey);
                if (existing != null && existing.getStatusCode() != 0) {
                    break;
                }
            }
        }

        if (existing == null || existing.getStatusCode() == 0) {
            throw new InvalidTransactionException("Concurrent transaction in progress for this idempotency key");
        }

        try {
            return objectMapper.readValue(existing.getResponseBody(), TransactionReceipt.class);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to deserialize cached response", e);
        }
    }

    private IdempotencyKeyRecord findRecord(Long userId, String idempotencyKey) {
        String sql = "SELECT user_id, idempotency_key, request_hash, status_code, response_body FROM idempotency_keys WHERE user_id = ? AND idempotency_key = ?";
        List<IdempotencyKeyRecord> results = jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new IdempotencyKeyRecord(
                        rs.getLong("user_id"),
                        rs.getString("idempotency_key"),
                        rs.getString("request_hash"),
                        rs.getInt("status_code"),
                        rs.getString("response_body")
                ),
                userId, idempotencyKey
        );
        return results.isEmpty() ? null : results.get(0);
    }
}

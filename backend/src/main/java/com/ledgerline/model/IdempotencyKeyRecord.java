package com.ledgerline.model;

import jakarta.persistence.*;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

import java.time.Instant;

/**
 * Idempotency key record for mutation endpoints (deposits, withdrawals, transfers).
 * <p>
 * Per AGENTS.md Rule 5 and BRIEF.md M3:
 * <ul>
 *   <li>Keys are claimed atomically via a single INSERT … WHERE NOT EXISTS statement.</li>
 *   <li>SHA-256 of the canonical request payload is stored; replays with different payloads
 *       are detected and rejected with HTTP 422.</li>
 *   <li>{@code statusCode == 0} means the winning thread is still processing; losers poll
 *       until a non-zero status appears (up to 10 seconds).</li>
 * </ul>
 */
@Entity
@Table(
    name = "idempotency_keys",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_user_idempotency", columnNames = {"user_id", "idempotency_key"})
    }
)
public class IdempotencyKeyRecord {

    /** Auto-generated surrogate primary key. Null before first persistence. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Nullable
    private Long id;

    /** FK to users.id — the user who submitted this idempotency key. */
    @NonNull
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** Client-provided idempotency key (e.g. a UUID string). Max 128 chars. */
    @NonNull
    @Column(name = "idempotency_key", nullable = false, length = 128)
    private String idempotencyKey = "";

    /**
     * SHA-256 hash of the canonical request payload (endpoint + account IDs + amount).
     * Used to detect same-key / different-payload replay attacks (AGENTS.md Rule 5).
     */
    @NonNull
    @Column(name = "request_hash", nullable = false, length = 64)
    private String requestHash = "";

    /**
     * HTTP status code of the completed response.
     * Value 0 means the transaction is still in-flight (being processed by the winning thread).
     * Value 201 means successfully completed. Losing threads poll until non-zero.
     */
    @Column(name = "status_code", nullable = false)
    private int statusCode;

    /** JSON-serialized {@link com.ledgerline.dto.TransactionReceipt} of the completed transaction. */
    @NonNull
    @Column(name = "response_body", nullable = false, columnDefinition = "TEXT")
    private String responseBody = "";

    /** Timestamp when this key was first claimed. Immutable after insertion. */
    @Nullable
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** No-arg constructor required by JPA. */
    public IdempotencyKeyRecord() {}

    /**
     * Creates a new idempotency key record.
     *
     * @param userId         FK to the owning user
     * @param idempotencyKey client-supplied key string
     * @param requestHash    SHA-256 of the canonical request payload
     * @param statusCode     HTTP status (0 = in-flight, 201 = complete)
     * @param responseBody   JSON-serialized response body
     */
    public IdempotencyKeyRecord(
            @NonNull Long userId,
            @NonNull String idempotencyKey,
            @NonNull String requestHash,
            int statusCode,
            @NonNull String responseBody
    ) {
        this.userId = userId;
        this.idempotencyKey = idempotencyKey;
        this.requestHash = requestHash;
        this.statusCode = statusCode;
        this.responseBody = responseBody;
        this.createdAt = Instant.now();
    }

    @Nullable
    public Long getId() { return id; }
    public void setId(@Nullable Long id) { this.id = id; }

    @NonNull
    public Long getUserId() { return userId; }
    public void setUserId(@NonNull Long userId) { this.userId = userId; }

    @NonNull
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(@NonNull String idempotencyKey) { this.idempotencyKey = idempotencyKey; }

    @NonNull
    public String getRequestHash() { return requestHash; }
    public void setRequestHash(@NonNull String requestHash) { this.requestHash = requestHash; }

    public int getStatusCode() { return statusCode; }
    public void setStatusCode(int statusCode) { this.statusCode = statusCode; }

    @NonNull
    public String getResponseBody() { return responseBody; }
    public void setResponseBody(@NonNull String responseBody) { this.responseBody = responseBody; }

    @Nullable
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(@Nullable Instant createdAt) { this.createdAt = createdAt; }
}

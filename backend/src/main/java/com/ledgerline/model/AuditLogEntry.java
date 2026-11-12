package com.ledgerline.model;

import jakarta.persistence.*;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

import java.time.Instant;

/**
 * An entry in the tamper-evident audit log.
 * <p>
 * Per AGENTS.md Rule 9 and BRIEF.md M4:
 * <ul>
 *   <li>Every money movement, denied access, and system event is recorded here.</li>
 *   <li>Each entry is linked to the previous one via SHA-256 hash chaining:
 *       {@code entry_hash = SHA-256(seq|timestamp|actor|role|action|target|result|ip|details|previous_hash)}.</li>
 *   <li>The {@link com.ledgerline.service.AuditService#verifyHashChain()} method traverses
 *       the full chain from genesis to detect any tampered, deleted, or inserted record.</li>
 * </ul>
 * <p>
 * This table is append-only. UPDATE and DELETE are blocked by PostgreSQL triggers in production
 * and by H2 triggers in test environments.
 */
@Entity
@Table(name = "audit_log")
public class AuditLogEntry {

    /** Auto-generated surrogate primary key. Null before first persistence. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Nullable
    private Long id;

    /** Strictly monotonically-increasing sequence number. Gaps indicate deleted records. */
    @NonNull
    @Column(name = "sequence_num", nullable = false, unique = true)
    private Long sequenceNum;

    /** Wall-clock timestamp when the event occurred (UTC, millisecond precision). */
    @NonNull
    @Column(name = "timestamp", nullable = false)
    private Instant timestamp;

    /** Username of the actor who triggered the event (or "anonymous" for unauthenticated). */
    @NonNull
    @Column(name = "actor_username", nullable = false, length = 50)
    private String actorUsername = "";

    /** Role of the actor at the time of the event (ADMIN, HOLDER, AUDITOR, or ANONYMOUS). */
    @NonNull
    @Column(name = "actor_role", nullable = false, length = 20)
    private String actorRole = "";

    /** Semantic action name, e.g. MONEY_DEPOSIT, ACCESS_DENIED_IDOR, USER_LOGIN. */
    @NonNull
    @Column(name = "action", nullable = false, length = 64)
    private String action = "";

    /** The API path or resource that was targeted, e.g. "/api/deposits". */
    @NonNull
    @Column(name = "target_resource", nullable = false, length = 128)
    private String targetResource = "";

    /** Outcome of the action: SUCCESS, FAILED, DENIED, or ALLOWED. */
    @NonNull
    @Column(name = "result", nullable = false, length = 20)
    private String result = "";

    /** Client IP address. Extracted from X-Forwarded-For or RemoteAddr. */
    @NonNull
    @Column(name = "ip_address", nullable = false, length = 45)
    private String ipAddress = "";

    /** Free-text contextual detail about the event. May be null. */
    @Nullable
    @Column(name = "details", columnDefinition = "TEXT")
    private String details;

    /** Hash of the immediately preceding audit entry, or the genesis hash for entry #1. */
    @NonNull
    @Column(name = "previous_hash", nullable = false, length = 64)
    private String previousHash = "";

    /**
     * SHA-256 hash of the concatenated fields of this entry including the previous_hash.
     * Any modification to this entry will cause hash chain verification to fail.
     */
    @NonNull
    @Column(name = "entry_hash", nullable = false, length = 64)
    private String entryHash = "";

    /** No-arg constructor required by JPA. */
    public AuditLogEntry() {
        this.sequenceNum = 0L;
        this.timestamp = Instant.now();
    }

    /**
     * Creates a fully-populated audit log entry.
     *
     * @param sequenceNum    monotonically-increasing sequence number
     * @param timestamp      when the event occurred (UTC)
     * @param actorUsername  who triggered it
     * @param actorRole      their role at event time
     * @param action         semantic action name
     * @param targetResource API path or resource affected
     * @param result         SUCCESS, FAILED, DENIED, or ALLOWED
     * @param ipAddress      client IP address
     * @param details        optional free-text context (may be null)
     * @param previousHash   SHA-256 hash of the preceding entry
     * @param entryHash      SHA-256 hash of this entry's concatenated fields
     */
    public AuditLogEntry(
            @NonNull Long sequenceNum,
            @NonNull Instant timestamp,
            @NonNull String actorUsername,
            @NonNull String actorRole,
            @NonNull String action,
            @NonNull String targetResource,
            @NonNull String result,
            @NonNull String ipAddress,
            @Nullable String details,
            @NonNull String previousHash,
            @NonNull String entryHash
    ) {
        this.sequenceNum = sequenceNum;
        this.timestamp = timestamp;
        this.actorUsername = actorUsername;
        this.actorRole = actorRole;
        this.action = action;
        this.targetResource = targetResource;
        this.result = result;
        this.ipAddress = ipAddress;
        this.details = details;
        this.previousHash = previousHash;
        this.entryHash = entryHash;
    }

    @Nullable
    public Long getId() { return id; }

    @NonNull
    public Long getSequenceNum() { return sequenceNum; }
    public void setSequenceNum(@NonNull Long sequenceNum) { this.sequenceNum = sequenceNum; }

    @NonNull
    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(@NonNull Instant timestamp) { this.timestamp = timestamp; }

    @NonNull
    public String getActorUsername() { return actorUsername; }
    public void setActorUsername(@NonNull String actorUsername) { this.actorUsername = actorUsername; }

    @NonNull
    public String getActorRole() { return actorRole; }
    public void setActorRole(@NonNull String actorRole) { this.actorRole = actorRole; }

    @NonNull
    public String getAction() { return action; }
    public void setAction(@NonNull String action) { this.action = action; }

    @NonNull
    public String getTargetResource() { return targetResource; }
    public void setTargetResource(@NonNull String targetResource) { this.targetResource = targetResource; }

    @NonNull
    public String getResult() { return result; }
    public void setResult(@NonNull String result) { this.result = result; }

    @NonNull
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(@NonNull String ipAddress) { this.ipAddress = ipAddress; }

    @Nullable
    public String getDetails() { return details; }
    public void setDetails(@Nullable String details) { this.details = details; }

    @NonNull
    public String getPreviousHash() { return previousHash; }
    public void setPreviousHash(@NonNull String previousHash) { this.previousHash = previousHash; }

    @NonNull
    public String getEntryHash() { return entryHash; }
    public void setEntryHash(@NonNull String entryHash) { this.entryHash = entryHash; }
}

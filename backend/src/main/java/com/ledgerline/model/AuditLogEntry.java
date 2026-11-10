package com.ledgerline.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * AGENTS.md Rule 9 & BRIEF.md M4:
 * Append-only audit log entry with SHA-256 hash chaining.
 * Proves non-repudiation and detects tampering across historical actions.
 */
@Entity
@Table(name = "audit_log")
public class AuditLogEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sequence_num", nullable = false, unique = true)
    private Long sequenceNum;

    @Column(name = "timestamp", nullable = false)
    private Instant timestamp;

    @Column(name = "actor_username", nullable = false, length = 50)
    private String actorUsername;

    @Column(name = "actor_role", nullable = false, length = 20)
    private String actorRole;

    @Column(name = "action", nullable = false, length = 64)
    private String action;

    @Column(name = "target_resource", nullable = false, length = 128)
    private String targetResource;

    @Column(name = "result", nullable = false, length = 20)
    private String result;

    @Column(name = "ip_address", nullable = false, length = 45)
    private String ipAddress;

    @Column(name = "details", columnDefinition = "TEXT")
    private String details;

    @Column(name = "previous_hash", nullable = false, length = 64)
    private String previousHash;

    @Column(name = "entry_hash", nullable = false, length = 64)
    private String entryHash;

    public AuditLogEntry() {}

    public AuditLogEntry(
            Long sequenceNum,
            Instant timestamp,
            String actorUsername,
            String actorRole,
            String action,
            String targetResource,
            String result,
            String ipAddress,
            String details,
            String previousHash,
            String entryHash
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

    public Long getId() {
        return id;
    }

    public Long getSequenceNum() {
        return sequenceNum;
    }

    public void setSequenceNum(Long sequenceNum) {
        this.sequenceNum = sequenceNum;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public String getActorUsername() {
        return actorUsername;
    }

    public void setActorUsername(String actorUsername) {
        this.actorUsername = actorUsername;
    }

    public String getActorRole() {
        return actorRole;
    }

    public void setActorRole(String actorRole) {
        this.actorRole = actorRole;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getTargetResource() {
        return targetResource;
    }

    public void setTargetResource(String targetResource) {
        this.targetResource = targetResource;
    }

    public String getResult() {
        return result;
    }

    public void setResult(String result) {
        this.result = result;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public String getPreviousHash() {
        return previousHash;
    }

    public void setPreviousHash(String previousHash) {
        this.previousHash = previousHash;
    }

    public String getEntryHash() {
        return entryHash;
    }

    public void setEntryHash(String entryHash) {
        this.entryHash = entryHash;
    }
}


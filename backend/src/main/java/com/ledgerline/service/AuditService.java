package com.ledgerline.service;

import com.ledgerline.dto.AuditLogResponse;
import com.ledgerline.model.AuditLogEntry;
import com.ledgerline.repository.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * AGENTS.md Rule 9 & BRIEF.md M4:
 * Audit service with SHA-256 cryptographic hash-chaining.
 * Every money action and denied access attempt is recorded and chained.
 */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);
    public static final String GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

    private final AuditLogRepository auditLogRepository;
    private final DataSource dataSource;

    public AuditService(AuditLogRepository auditLogRepository, DataSource dataSource) {
        this.auditLogRepository = auditLogRepository;
        this.dataSource = dataSource;
    }

    /**
     * Appends a new audit log record linked to the previous entry via SHA-256 hash.
     * Uses a direct committed database connection so audit logs are permanently stored
     * even if caller transactions roll back (e.g. security violations and 404/403 rejections).
     */
    public synchronized AuditLogEntry logEvent(
            String actorUsername,
            String actorRole,
            String action,
            String targetResource,
            String result,
            String ipAddress,
            String details
    ) {
        String queryLastSql = "SELECT sequence_num, entry_hash FROM audit_log ORDER BY sequence_num DESC LIMIT 1";
        String insertSql = "INSERT INTO audit_log (sequence_num, timestamp, actor_username, actor_role, action, target_resource, result, ip_address, details, previous_hash, entry_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        Long lastSeq = null;
        String previousHash = GENESIS_HASH;

        try (Connection conn = dataSource.getConnection()) {
            conn.setAutoCommit(true);

            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery(queryLastSql)) {
                if (rs.next()) {
                    lastSeq = rs.getLong("sequence_num");
                    previousHash = rs.getString("entry_hash");
                }
            }

            long sequenceNum = (lastSeq != null ? lastSeq + 1 : 1L);
            Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);

            String finalActor = actorUsername != null ? actorUsername : "anonymous";
            String finalRole = actorRole != null ? actorRole : "ANONYMOUS";
            String finalIp = ipAddress != null ? ipAddress : "127.0.0.1";
            String finalDetails = details != null ? details : "";

            String entryHash = computeHash(
                    sequenceNum,
                    now,
                    finalActor,
                    finalRole,
                    action,
                    targetResource,
                    result,
                    finalIp,
                    finalDetails,
                    previousHash
            );

            try (PreparedStatement pstmt = conn.prepareStatement(insertSql)) {
                pstmt.setLong(1, sequenceNum);
                pstmt.setTimestamp(2, Timestamp.from(now));
                pstmt.setString(3, finalActor);
                pstmt.setString(4, finalRole);
                pstmt.setString(5, action);
                pstmt.setString(6, targetResource);
                pstmt.setString(7, result);
                pstmt.setString(8, finalIp);
                pstmt.setString(9, finalDetails);
                pstmt.setString(10, previousHash);
                pstmt.setString(11, entryHash);
                pstmt.executeUpdate();
            }

            return new AuditLogEntry(
                    sequenceNum,
                    now,
                    finalActor,
                    finalRole,
                    action,
                    targetResource,
                    result,
                    finalIp,
                    finalDetails,
                    previousHash,
                    entryHash
            );
        } catch (SQLException e) {
            log.error("Failed to append audit log entry: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to append audit log entry", e);
        }
    }

    /**
     * Convenience method to log an audit event from current security and request context.
     */
    public void logFromContext(String action, String targetResource, String result, String details) {
        String username = "anonymous";
        String role = "ANONYMOUS";
        String ipAddress = "127.0.0.1";

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
            username = auth.getName();
            role = auth.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .findFirst()
                    .orElse("ROLE_USER")
                    .replace("ROLE_", "");
        }

        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                String xForwarded = request.getHeader("X-Forwarded-For");
                if (xForwarded != null && !xForwarded.isBlank()) {
                    ipAddress = xForwarded.split(",")[0].trim();
                } else if (request.getRemoteAddr() != null) {
                    ipAddress = request.getRemoteAddr();
                }
            }
        } catch (Exception e) {
            log.debug("Could not resolve client IP address: {}", e.getMessage());
        }

        logEvent(username, role, action, targetResource, result, ipAddress, details);
    }

    @Transactional(readOnly = true)
    public Page<AuditLogResponse> getAuditLogs(Pageable pageable) {
        return auditLogRepository.findAllByOrderBySequenceNumDesc(pageable)
                .map(this::toResponse);
    }

    /**
     * Validates cryptographic hash-chain continuity from genesis (sequence 1) to head.
     * Returns null if valid, or a descriptive error message identifying the exact compromised sequence.
     */
    @Transactional(readOnly = true)
    public HashChainValidationResult verifyHashChain() {
        List<AuditLogEntry> entries = auditLogRepository.findAllByOrderBySequenceNumAsc();
        if (entries.isEmpty()) {
            return new HashChainValidationResult(true, 0, null);
        }

        String expectedPrevHash = GENESIS_HASH;
        long expectedSequence = 1;

        for (AuditLogEntry entry : entries) {
            if (entry.getSequenceNum() != expectedSequence) {
                return new HashChainValidationResult(
                        false,
                        expectedSequence - 1,
                        "Sequence gap detected: expected " + expectedSequence + " but found " + entry.getSequenceNum()
                );
            }

            if (!entry.getPreviousHash().equals(expectedPrevHash)) {
                return new HashChainValidationResult(
                        false,
                        entry.getSequenceNum(),
                        "Broken previous_hash chain at sequence " + entry.getSequenceNum() +
                        ": expected " + expectedPrevHash + " but found " + entry.getPreviousHash()
                );
            }

            String recomputedHash = computeHash(
                    entry.getSequenceNum(),
                    entry.getTimestamp(),
                    entry.getActorUsername(),
                    entry.getActorRole(),
                    entry.getAction(),
                    entry.getTargetResource(),
                    entry.getResult(),
                    entry.getIpAddress(),
                    entry.getDetails(),
                    entry.getPreviousHash()
            );

            if (!entry.getEntryHash().equals(recomputedHash)) {
                return new HashChainValidationResult(
                        false,
                        entry.getSequenceNum(),
                        "Tampering detected at sequence " + entry.getSequenceNum() +
                        ": stored hash " + entry.getEntryHash() + " does not match calculated hash " + recomputedHash
                );
            }

            expectedPrevHash = entry.getEntryHash();
            expectedSequence++;
        }

        return new HashChainValidationResult(true, entries.size(), null);
    }

    public static String computeHash(
            long sequenceNum,
            Instant timestamp,
            String actorUsername,
            String actorRole,
            String action,
            String targetResource,
            String result,
            String ipAddress,
            String details,
            String previousHash
    ) {
        String payload = sequenceNum + "|" +
                timestamp.toString() + "|" +
                actorUsername + "|" +
                actorRole + "|" +
                action + "|" +
                targetResource + "|" +
                result + "|" +
                ipAddress + "|" +
                (details != null ? details : "") + "|" +
                previousHash;

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 digest algorithm not available", e);
        }
    }

    private AuditLogResponse toResponse(AuditLogEntry entry) {
        return new AuditLogResponse(
                entry.getId(),
                entry.getSequenceNum(),
                entry.getTimestamp(),
                entry.getActorUsername(),
                entry.getActorRole(),
                entry.getAction(),
                entry.getTargetResource(),
                entry.getResult(),
                entry.getIpAddress(),
                entry.getDetails(),
                entry.getPreviousHash(),
                entry.getEntryHash()
        );
    }

    public record HashChainValidationResult(boolean valid, long entriesVerified, String errorMessage) {}
}

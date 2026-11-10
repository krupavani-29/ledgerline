package com.ledgerline;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ledgerline.model.Role;
import com.ledgerline.security.JwtService;
import com.ledgerline.service.AuditService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * BRIEF.md Module 4 & THREATS.md Threats 4, 7, 8:
 * Automated verification of:
 * - Append-only immutability triggers on ledger_entries and audit_log
 * - SHA-256 cryptographic hash-chaining of audit trail
 * - Paginated Statement API with anti-enumeration defense
 * - Audit Log inspection RBAC (Auditor/Admin only, Holder 403)
 * - Complete system integrity reconciliation (ledger sum == 0, balances == entry sums, hash chain unbroken)
 * - Tampering detection by /api/integrity
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuditAndIntegrityIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private AuditService auditService;

    // =========================================================================
    // 1. APPEND-ONLY TRIGGERS (AGENTS.md Rule 9 & BRIEF.md M4)
    // =========================================================================

    @Test
    @DisplayName("BRIEF.md M4: UPDATE or DELETE on ledger_entries is prohibited by append-only trigger")
    void appendOnlyTriggers_blockUpdateAndDeleteOnLedgerEntries() {
        // Attempting to UPDATE any ledger entry must fail with SQL exception
        assertThrows(Exception.class, () -> {
            jdbcTemplate.update("UPDATE ledger_entries SET amount = 999999 WHERE id = 1");
        }, "Direct UPDATE on ledger_entries must be rejected by trigger");

        // Attempting to DELETE any ledger entry must fail with SQL exception
        assertThrows(Exception.class, () -> {
            jdbcTemplate.update("DELETE FROM ledger_entries WHERE id = 1");
        }, "Direct DELETE on ledger_entries must be rejected by trigger");
    }

    @Test
    @DisplayName("BRIEF.md M4: UPDATE or DELETE on audit_log is prohibited by append-only trigger")
    void appendOnlyTriggers_blockUpdateAndDeleteOnAuditLog() {
        // Ensure at least one entry exists
        auditService.logFromContext("SYSTEM_STARTUP", "/system", "SUCCESS", "Startup check");

        // Attempting to UPDATE any audit log entry must fail with SQL exception
        assertThrows(Exception.class, () -> {
            jdbcTemplate.update("UPDATE audit_log SET details = 'tampered' WHERE sequence_num = 1");
        }, "Direct UPDATE on audit_log must be rejected by trigger");

        // Attempting to DELETE any audit log entry must fail with SQL exception
        assertThrows(Exception.class, () -> {
            jdbcTemplate.update("DELETE FROM audit_log WHERE sequence_num = 1");
        }, "Direct DELETE on audit_log must be rejected by trigger");
    }

    // =========================================================================
    // 2. AUDIT LOGGING & HASH-CHAINING (BRIEF.md M4 & THREATS.md Threat 7)
    // =========================================================================

    @Test
    @DisplayName("BRIEF.md M4: Money movements create chained audit log entries with verifiable SHA-256 hashes")
    void auditLogging_recordsMoneyActionsWithHashChain() throws Exception {
        String ashaToken = jwtService.generateToken("asha", Role.HOLDER, 2L);
        String key = "audit-test-key-" + UUID.randomUUID();

        // Perform a deposit
        mockMvc.perform(post("/api/deposits")
                        .header("Authorization", "Bearer " + ashaToken)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\": 2, \"amount\": 25000, \"description\": \"Salary deposit\"}"))
                .andExpect(status().isCreated());

        // Verify cryptographic hash-chain continuity from genesis
        AuditService.HashChainValidationResult result = auditService.verifyHashChain();
        assertTrue(result.valid(), "Hash chain must remain unbroken: " + result.errorMessage());
        assertTrue(result.entriesVerified() > 0, "At least one audit entry must be verified");
    }

    @Test
    @DisplayName("BRIEF.md M4 & THREATS.md Threat 4: Denied access attempts (IDOR) are recorded in audit log")
    void auditLogging_recordsDeniedAccessAttempts() throws Exception {
        String ashaToken = jwtService.generateToken("asha", Role.HOLDER, 2L);

        // Asha attempts to read Ravi's account 3 (foreign account)
        mockMvc.perform(get("/api/accounts/3")
                        .header("Authorization", "Bearer " + ashaToken))
                .andExpect(status().isNotFound()); // 404 anti-enumeration

        // Verify an audit entry for ACCOUNT_ACCESS_DENIED exists
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM audit_log WHERE action = 'ACCOUNT_ACCESS_DENIED' AND actor_username = 'asha'",
                Integer.class
        );
        assertNotNull(count);
        assertTrue(count >= 1, "Denied access attempt must be recorded in audit_log");
    }

    // =========================================================================
    // 3. STATEMENT API (BRIEF.md M4 & AGENTS.md Rule 8)
    // =========================================================================

    @Test
    @DisplayName("BRIEF.md M4: HOLDER reading own statement returns 200 with paginated ledger entries")
    void statementApi_holderReadsOwnStatement_success() throws Exception {
        String ashaToken = jwtService.generateToken("asha", Role.HOLDER, 2L);
        String key = "stmt-test-key-" + UUID.randomUUID();

        // Create a transaction to guarantee statement entries
        mockMvc.perform(post("/api/deposits")
                        .header("Authorization", "Bearer " + ashaToken)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\": 2, \"amount\": 5000, \"description\": \"Statement entry test\"}"))
                .andExpect(status().isCreated());

        MvcResult result = mockMvc.perform(get("/api/accounts/2/statement?page=0&size=10")
                        .header("Authorization", "Bearer " + ashaToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountId").value(2))
                .andExpect(jsonPath("$.accountNumber").value("ACC-1042"))
                .andExpect(jsonPath("$.entries").isArray())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        assertTrue(json.get("entries").size() > 0, "Statement must contain entries");
        assertNotNull(json.get("entries").get(0).get("referenceId"));
        assertNotNull(json.get("entries").get(0).get("runningBalance"));
    }

    @Test
    @DisplayName("BRIEF.md M4 & AGENTS.md Rule 8: HOLDER reading foreign account statement returns 404 (not 403)")
    void statementApi_holderReadingForeignStatement_returns404() throws Exception {
        String ashaToken = jwtService.generateToken("asha", Role.HOLDER, 2L);

        // Asha tries to read Ravi's statement (account 3)
        mockMvc.perform(get("/api/accounts/3/statement")
                        .header("Authorization", "Bearer " + ashaToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("BRIEF.md M4 & AGENTS.md Rule 8: AUDITOR can read statement for any account")
    void statementApi_auditorCanReadAnyStatement() throws Exception {
        String auditorToken = jwtService.generateToken("auditor", Role.AUDITOR, 4L);

        // Auditor reads Asha's account 2 statement
        mockMvc.perform(get("/api/accounts/2/statement")
                        .header("Authorization", "Bearer " + auditorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountId").value(2));

        // Auditor reads Ravi's account 3 statement
        mockMvc.perform(get("/api/accounts/3/statement")
                        .header("Authorization", "Bearer " + auditorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountId").value(3));
    }

    // =========================================================================
    // 4. AUDIT TRAIL API (BRIEF.md M4 & AGENTS.md Rule 8)
    // =========================================================================

    @Test
    @DisplayName("BRIEF.md M4 & AGENTS.md Rule 8: AUDITOR can inspect audit trail; HOLDER is forbidden (403)")
    void auditApi_auditorCanRead_holderForbidden() throws Exception {
        String auditorToken = jwtService.generateToken("auditor", Role.AUDITOR, 4L);
        String holderToken = jwtService.generateToken("asha", Role.HOLDER, 2L);

        // Auditor reading audit log returns 200 with paginated entries
        mockMvc.perform(get("/api/audit?page=0&size=20")
                        .header("Authorization", "Bearer " + auditorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());

        // Holder reading audit log returns 403 Forbidden
        mockMvc.perform(get("/api/audit")
                        .header("Authorization", "Bearer " + holderToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    // =========================================================================
    // 5. INTEGRITY RECONCILIATION API (BRIEF.md M4 & THREATS.md Threat 8)
    // =========================================================================

    @Test
    @DisplayName("BRIEF.md M4: GET /api/integrity verifies conservation, balances, and hash chain on healthy system")
    void integrityApi_healthySystem_returnsOk() throws Exception {
        String auditorToken = jwtService.generateToken("auditor", Role.AUDITOR, 4L);
        String holderToken = jwtService.generateToken("asha", Role.HOLDER, 2L);

        // Holder access returns 403 Forbidden
        mockMvc.perform(get("/api/integrity")
                        .header("Authorization", "Bearer " + holderToken))
                .andExpect(status().isForbidden());

        // Auditor access returns 200 with full health report
        mockMvc.perform(get("/api/integrity")
                        .header("Authorization", "Bearer " + auditorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("HEALTHY"))
                .andExpect(jsonPath("$.ledgerConserved").value(true))
                .andExpect(jsonPath("$.totalLedgerSum").value(0))
                .andExpect(jsonPath("$.accountsReconciled").value(true))
                .andExpect(jsonPath("$.hashChainValid").value(true))
                .andExpect(jsonPath("$.tamperDetails").doesNotExist());
    }

    @Test
    @DisplayName("BRIEF.md M4 & THREATS.md Threat 7: /api/integrity detects account balance tampering")
    void integrityApi_detectsAccountBalanceTampering() throws Exception {
        String auditorToken = jwtService.generateToken("auditor", Role.AUDITOR, 4L);

        // Simulating rogue direct DB modification: artificially increase account 2 balance by ₹100 (10,000 paise)
        jdbcTemplate.update("UPDATE accounts SET balance = balance + 10000 WHERE id = 2");

        try {
            MvcResult result = mockMvc.perform(get("/api/integrity")
                            .header("Authorization", "Bearer " + auditorToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("TAMPERED"))
                    .andExpect(jsonPath("$.accountsReconciled").value(false))
                    .andReturn();

            JsonNode node = objectMapper.readTree(result.getResponse().getContentAsString());
            assertTrue(node.get("tamperDetails").asText().contains("Account balance mismatch on ID 2"));
        } finally {
            // Restore balance so subsequent tests are not contaminated
            jdbcTemplate.update("UPDATE accounts SET balance = balance - 10000 WHERE id = 2");
        }
    }
}

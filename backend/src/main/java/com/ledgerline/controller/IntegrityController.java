package com.ledgerline.controller;

import com.ledgerline.dto.IntegrityReportResponse;
import com.ledgerline.service.IntegrityService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * BRIEF.md M4 & AGENTS.md Rules 3 & 9:
 * System integrity reconciliation endpoint:
 * 1. Checks that the total ledger sum across all accounts equals 0 paise.
 * 2. Checks that each account balance equals the sum of its ledger entries.
 * 3. Verifies the SHA-256 cryptographic hash chain of the audit trail from genesis to head.
 * Restricted strictly to AUDITOR and ADMIN roles. HOLDER access returns 403 Forbidden.
 */
@RestController
@RequestMapping("/api/integrity")
public class IntegrityController {

    private final IntegrityService integrityService;

    public IntegrityController(IntegrityService integrityService) {
        this.integrityService = integrityService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'AUDITOR')")
    public ResponseEntity<IntegrityReportResponse> checkIntegrity() {
        IntegrityReportResponse report = integrityService.checkIntegrity();
        return ResponseEntity.ok(report);
    }
}


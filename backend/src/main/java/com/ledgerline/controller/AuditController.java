package com.ledgerline.controller;

import com.ledgerline.dto.AuditLogResponse;
import com.ledgerline.service.AuditService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * BRIEF.md M4 & AGENTS.md Rule 8:
 * Audit trail inspection endpoint.
 * Restricted strictly to AUDITOR and ADMIN roles. HOLDER access returns 403 Forbidden.
 */
@RestController
@RequestMapping("/api/audit")
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'AUDITOR')")
    public ResponseEntity<Page<AuditLogResponse>> getAuditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        int boundedPage = Math.max(page, 0);
        int boundedSize = Math.min(Math.max(size, 1), 100);
        Page<AuditLogResponse> logs = auditService.getAuditLogs(PageRequest.of(boundedPage, boundedSize));
        return ResponseEntity.ok(logs);
    }
}


package com.ledgerline.controller;

import com.ledgerline.dto.AccountStatementResponse;
import com.ledgerline.service.StatementService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * BRIEF.md M4 & AGENTS.md Rule 8:
 * Paginated statement endpoint for checking account transaction history and running balances.
 * Security: HOLDER can only read own statement. Foreign account access returns 404 (not 403)
 * to prevent attacker account ID enumeration.
 */
@RestController
@RequestMapping("/api")
public class StatementController {

    private final StatementService statementService;

    public StatementController(StatementService statementService) {
        this.statementService = statementService;
    }

    @GetMapping("/accounts/{id}/statement")
    @PreAuthorize("hasAnyRole('ADMIN', 'AUDITOR', 'HOLDER')")
    public ResponseEntity<AccountStatementResponse> getStatement(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication
    ) {
        AccountStatementResponse statement = statementService.getStatement(
                authentication.getName(),
                id,
                page,
                size
        );
        return ResponseEntity.ok(statement);
    }
}


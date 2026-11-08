package com.ledgerline.controller;

import com.ledgerline.dto.AccountResponse;
import com.ledgerline.dto.CreateAccountRequest;
import com.ledgerline.service.AccountService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    // Security Decision (AGENTS.md Rule 7 & 8):
    // Identity is derived from the authenticated JWT principal (authentication.getName()), never from request parameters.
    // HOLDER users receive only their own accounts. ADMIN and AUDITOR can inspect all accounts.
    @GetMapping
    public ResponseEntity<List<AccountResponse>> getAccounts(Authentication authentication) {
        List<AccountResponse> accounts = accountService.getAccountsForCurrentUser(authentication.getName());
        return ResponseEntity.ok(accounts);
    }

    // Security Decision (AGENTS.md Rule 8 & Threat 3):
    // When a HOLDER queries an account ID that does not belong to them, the service throws ResourceNotFoundException (404).
    // Returning 404 instead of 403 prevents attackers from enumerating valid account IDs.
    @GetMapping("/{id}")
    public ResponseEntity<AccountResponse> getAccountById(@PathVariable Long id, Authentication authentication) {
        AccountResponse account = accountService.getAccountById(id, authentication.getName());
        return ResponseEntity.ok(account);
    }

    // Security Decision (AGENTS.md Rule 7 & 8):
    // Only ADMIN role may create accounts via @PreAuthorize("hasRole('ADMIN')").
    // Client-supplied balance fields are discarded to prevent mass-assignment privilege escalation.
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AccountResponse> createAccount(@Valid @RequestBody CreateAccountRequest request) {
        AccountResponse created = accountService.createAccount(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}

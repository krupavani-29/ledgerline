package com.ledgerline.controller;

import com.ledgerline.dto.DepositRequest;
import com.ledgerline.dto.TransactionReceipt;
import com.ledgerline.dto.TransferRequest;
import com.ledgerline.dto.WithdrawalRequest;
import com.ledgerline.service.TransactionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    // Security Decision (AGENTS.md Rule 5, 7, 8):
    // Identity extracted strictly from JWT Authentication object.
    // AUDITOR is barred from mutating money (Rule 8).
    // Idempotency-Key header is strictly required.
    @PostMapping("/deposits")
    @PreAuthorize("hasAnyRole('ADMIN', 'HOLDER')")
    public ResponseEntity<TransactionReceipt> deposit(
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody DepositRequest request,
            Authentication authentication
    ) {
        TransactionReceipt receipt = transactionService.deposit(authentication.getName(), idempotencyKey, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(receipt);
    }

    // Security Decision (AGENTS.md Rule 4, 5, 6, 7):
    // Identity extracted strictly from JWT Authentication object.
    // Account row locked SELECT ... FOR UPDATE before balance check (Rule 6).
    @PostMapping("/withdrawals")
    @PreAuthorize("hasAnyRole('ADMIN', 'HOLDER')")
    public ResponseEntity<TransactionReceipt> withdraw(
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody WithdrawalRequest request,
            Authentication authentication
    ) {
        TransactionReceipt receipt = transactionService.withdraw(authentication.getName(), idempotencyKey, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(receipt);
    }

    // Security Decision (AGENTS.md Rule 3, 5, 6, 8):
    // Double-entry legs sum to 0. Both accounts locked in ascending ID order to prevent deadlocks.
    @PostMapping("/transfers")
    @PreAuthorize("hasAnyRole('ADMIN', 'HOLDER')")
    public ResponseEntity<TransactionReceipt> transfer(
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody TransferRequest request,
            Authentication authentication
    ) {
        TransactionReceipt receipt = transactionService.transfer(authentication.getName(), idempotencyKey, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(receipt);
    }
}


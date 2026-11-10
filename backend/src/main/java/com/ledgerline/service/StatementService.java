package com.ledgerline.service;

import com.ledgerline.dto.AccountStatementResponse;
import com.ledgerline.dto.StatementEntryResponse;
import com.ledgerline.exception.ResourceNotFoundException;
import com.ledgerline.model.Account;
import com.ledgerline.model.LedgerEntry;
import com.ledgerline.model.Role;
import com.ledgerline.model.Transaction;
import com.ledgerline.model.User;
import com.ledgerline.repository.AccountRepository;
import com.ledgerline.repository.LedgerEntryRepository;
import com.ledgerline.repository.TransactionRepository;
import com.ledgerline.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * BRIEF.md M4 & AGENTS.md Rule 8:
 * Paginated statement generation with strict server-side ownership checks.
 * Non-owned account access by a HOLDER returns 404 (anti-enumeration).
 */
@Service
public class StatementService {

    private final AccountRepository accountRepository;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    public StatementService(
            AccountRepository accountRepository,
            LedgerEntryRepository ledgerEntryRepository,
            TransactionRepository transactionRepository,
            UserRepository userRepository,
            AuditService auditService
    ) {
        this.accountRepository = accountRepository;
        this.ledgerEntryRepository = ledgerEntryRepository;
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public AccountStatementResponse getStatement(String username, Long accountId, int page, int size) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found"));

        // AGENTS.md Rule 8: Anti-enumeration defense
        // HOLDER requesting foreign account returns 404 Not Found (not 403),
        // preventing attackers from discovering existing account IDs.
        if (user.getRole() == Role.HOLDER && !Objects.equals(account.getUserId(), user.getId())) {
            auditService.logEvent(
                    user.getUsername(),
                    user.getRole().name(),
                    "STATEMENT_ACCESS_DENIED",
                    "/api/accounts/" + accountId + "/statement",
                    "DENIED",
                    null,
                    "Unauthorized statement access attempt by user " + username
            );
            throw new ResourceNotFoundException("Account not found");
        }

        // Limit maximum page size to prevent denial of service memory pressure
        int boundedSize = Math.min(Math.max(size, 1), 100);
        int boundedPage = Math.max(page, 0);
        Pageable pageable = PageRequest.of(boundedPage, boundedSize);

        Page<LedgerEntry> entriesPage = ledgerEntryRepository.findByAccountIdOrderByIdDesc(accountId, pageable);

        List<Long> txIds = entriesPage.getContent().stream()
                .map(LedgerEntry::getTransactionId)
                .distinct()
                .toList();

        Map<Long, Transaction> txMap = transactionRepository.findAllById(txIds).stream()
                .collect(Collectors.toMap(Transaction::getId, Function.identity()));

        List<StatementEntryResponse> statementEntries = entriesPage.getContent().stream()
                .map(entry -> {
                    Transaction tx = txMap.get(entry.getTransactionId());
                    return new StatementEntryResponse(
                            entry.getId(),
                            entry.getTransactionId(),
                            tx != null ? tx.getReferenceId() : null,
                            tx != null ? tx.getTransactionType() : null,
                            entry.getAmount(),
                            entry.getRunningBalance(),
                            tx != null ? tx.getDescription() : null,
                            entry.getCreatedAt()
                    );
                })
                .toList();

        return new AccountStatementResponse(
                account.getId(),
                account.getAccountNumber(),
                account.getCurrency(),
                account.getBalance(),
                entriesPage.getNumber(),
                entriesPage.getSize(),
                entriesPage.getTotalElements(),
                entriesPage.getTotalPages(),
                statementEntries
        );
    }
}

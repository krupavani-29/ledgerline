package com.ledgerline.service;

import com.ledgerline.dto.IntegrityReportResponse;
import com.ledgerline.model.Account;
import com.ledgerline.repository.AccountRepository;
import com.ledgerline.repository.LedgerEntryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * BRIEF.md M4 & AGENTS.md Rules 3 & 9:
 * Performs complete ledger and audit trail integrity reconciliation:
 * 1. Mathematical conservation: sum of all ledger entries == 0.
 * 2. Account balance reconciliation: every account's balance == sum of its ledger entries.
 * 3. Cryptographic audit trail: SHA-256 hash chain verified from genesis to head.
 */
@Service
public class IntegrityService {

    private static final Logger log = LoggerFactory.getLogger(IntegrityService.class);

    private final AccountRepository accountRepository;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final AuditService auditService;

    public IntegrityService(
            AccountRepository accountRepository,
            LedgerEntryRepository ledgerEntryRepository,
            AuditService auditService
    ) {
        this.accountRepository = accountRepository;
        this.ledgerEntryRepository = ledgerEntryRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public IntegrityReportResponse checkIntegrity() {
        // 1. Check ledger conservation (AGENTS.md Rule 3: total sum must equal 0 paise)
        Long totalLedgerSum = ledgerEntryRepository.sumAllAmounts();
        boolean ledgerConserved = (totalLedgerSum != null && totalLedgerSum == 0L);

        // 2. Check each account balance against sum of its individual ledger entries
        List<Account> accounts = accountRepository.findAll();
        boolean accountsReconciled = true;
        String accountTamperDetail = null;

        for (Account account : accounts) {
            Long entrySum = ledgerEntryRepository.sumAmountsByAccountId(account.getId());
            long expectedSum = entrySum != null ? entrySum : 0L;
            if (account.getBalance() != expectedSum) {
                accountsReconciled = false;
                accountTamperDetail = "Account balance mismatch on ID " + account.getId() +
                        " (" + account.getAccountNumber() + "): stored balance = " + account.getBalance() +
                        " paise, calculated sum of ledger entries = " + expectedSum + " paise";
                log.error("Integrity check failure: {}", accountTamperDetail);
                break;
            }
        }

        // 3. Check cryptographic hash chain of audit trail (AGENTS.md Rule 9)
        AuditService.HashChainValidationResult hashResult = auditService.verifyHashChain();
        boolean hashChainValid = hashResult.valid();

        boolean allHealthy = ledgerConserved && accountsReconciled && hashChainValid;
        String status = allHealthy ? "HEALTHY" : "TAMPERED";

        StringBuilder tamperDetails = new StringBuilder();
        if (!ledgerConserved) {
            tamperDetails.append("System ledger does not conserve: sum is ").append(totalLedgerSum).append(" paise. ");
        }
        if (!accountsReconciled) {
            tamperDetails.append(accountTamperDetail).append(". ");
        }
        if (!hashChainValid) {
            tamperDetails.append("Audit trail corruption: ").append(hashResult.errorMessage()).append(". ");
        }

        return new IntegrityReportResponse(
                status,
                ledgerConserved,
                totalLedgerSum,
                accountsReconciled,
                accounts.size(),
                hashChainValid,
                hashResult.entriesVerified(),
                allHealthy ? null : tamperDetails.toString().trim()
        );
    }
}


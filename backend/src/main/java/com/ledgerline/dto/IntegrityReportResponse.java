package com.ledgerline.dto;

import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

/**
 * Response body for GET /api/integrity.
 * Reports the health of the double-entry ledger, account reconciliation, and audit hash chain.
 *
 * @param status               "HEALTHY" or "TAMPERED"
 * @param ledgerConserved      true if sum of all ledger entry amounts == 0
 * @param totalLedgerSum       actual sum of all ledger amounts in paise (should be 0)
 * @param accountsReconciled   true if every account.balance == sum of its ledger entries
 * @param accountsChecked      number of accounts inspected
 * @param hashChainValid       true if SHA-256 audit hash chain is unbroken from genesis to head
 * @param auditEntriesVerified number of audit entries whose hashes were verified
 * @param tamperDetails        human-readable tampering description; null when HEALTHY
 */
public record IntegrityReportResponse(
        @NonNull String status,
        boolean ledgerConserved,
        @Nullable Long totalLedgerSum,
        boolean accountsReconciled,
        int accountsChecked,
        boolean hashChainValid,
        long auditEntriesVerified,
        @Nullable String tamperDetails
) {}

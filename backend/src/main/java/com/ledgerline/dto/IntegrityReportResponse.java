package com.ledgerline.dto;

public record IntegrityReportResponse(
        String status,
        boolean ledgerConserved,
        Long totalLedgerSum,
        boolean accountsReconciled,
        int accountsChecked,
        boolean hashChainValid,
        long auditEntriesVerified,
        String tamperDetails
) {}


package com.ledgerline.dto;

import org.springframework.lang.NonNull;

import java.util.List;

/**
 * Paginated account statement response for GET /api/accounts/{id}/statement.
 *
 * @param accountId      surrogate ID of the account
 * @param accountNumber  human-readable account identifier (e.g. "ACC-1042")
 * @param currency       ISO 4217 currency code (e.g. "INR")
 * @param currentBalance current account balance in paise
 * @param page           zero-based page number returned
 * @param size           number of entries per page
 * @param totalElements  total number of ledger entries for this account
 * @param totalPages     total number of pages available
 * @param entries        ledger entries for this page, newest first
 */
public record AccountStatementResponse(
        @NonNull Long accountId,
        @NonNull String accountNumber,
        @NonNull String currency,
        @NonNull Long currentBalance,
        int page,
        int size,
        long totalElements,
        int totalPages,
        @NonNull List<StatementEntryResponse> entries
) {}

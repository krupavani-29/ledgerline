package com.ledgerline.dto;

import com.ledgerline.model.Account;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

import java.time.Instant;

/**
 * Public-facing representation of a bank account.
 * Returned by GET /api/accounts and GET /api/accounts/{id}.
 *
 * @param id            surrogate PK
 * @param accountNumber human-readable account identifier (e.g. "ACC-1042")
 * @param userId        FK to the owning user; null for the system settlement account
 * @param isSystem      true for the internal SYSTEM_RESERVE account
 * @param balance       current balance in paise (integer minor units)
 * @param currency      ISO 4217 currency code (e.g. "INR")
 * @param createdAt     when the account was opened
 */
public record AccountResponse(
        @Nullable Long id,
        @NonNull String accountNumber,
        @Nullable Long userId,
        boolean isSystem,
        @NonNull Long balance,
        @NonNull String currency,
        @NonNull Instant createdAt
) {
    /**
     * Maps an {@link Account} entity to its public DTO representation.
     *
     * @param acc the account entity
     * @return the public-facing DTO
     */
    @NonNull
    public static AccountResponse from(@NonNull Account acc) {
        return new AccountResponse(
                acc.getId(),
                acc.getAccountNumber(),
                acc.getUserId(),
                acc.isSystem(),
                acc.getBalance(),
                acc.getCurrency(),
                acc.getCreatedAt()
        );
    }
}

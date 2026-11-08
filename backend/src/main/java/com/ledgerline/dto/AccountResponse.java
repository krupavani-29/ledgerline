package com.ledgerline.dto;

import com.ledgerline.model.Account;
import java.time.Instant;

public record AccountResponse(
    Long id,
    String accountNumber,
    Long userId,
    boolean isSystem,
    Long balance,
    String currency,
    Instant createdAt
) {
    public static AccountResponse from(Account acc) {
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


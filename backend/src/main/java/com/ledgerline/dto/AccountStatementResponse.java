package com.ledgerline.dto;

import java.util.List;

public record AccountStatementResponse(
        Long accountId,
        String accountNumber,
        String currency,
        Long currentBalance,
        int page,
        int size,
        long totalElements,
        int totalPages,
        List<StatementEntryResponse> entries
) {}


package com.ledgerline.dto;

import com.ledgerline.model.Role;

public record RegisterResponse(
        Long userId,
        String username,
        Role role,
        String fullName,
        String token,
        Long accountId,
        String accountNumber
) {}


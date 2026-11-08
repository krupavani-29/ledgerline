package com.ledgerline.dto;

import jakarta.validation.constraints.NotBlank;

// AGENTS.md Rule 7: DTO explicitly accepts only credentials. Any extra fields (role, balance, etc.) are ignored.
public record LoginRequest(
    @NotBlank(message = "Username is required")
    String username,

    @NotBlank(message = "Password is required")
    String password
) {}


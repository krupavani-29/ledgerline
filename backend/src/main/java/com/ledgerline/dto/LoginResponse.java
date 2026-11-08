package com.ledgerline.dto;

public record LoginResponse(
    String token,
    String role,
    String username,
    long expiresInMs
) {}


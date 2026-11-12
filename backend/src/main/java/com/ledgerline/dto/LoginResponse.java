package com.ledgerline.dto;

import org.springframework.lang.NonNull;

/**
 * Response body for POST /api/auth/login and POST /api/auth/bootstrap-admin.
 *
 * @param token       signed JWT to include as {@code Authorization: Bearer <token>} on subsequent requests
 * @param role        the user's RBAC role (ADMIN, HOLDER, or AUDITOR)
 * @param username    the authenticated user's login name
 * @param expiresInMs token lifetime in milliseconds from issue time
 */
public record LoginResponse(
        @NonNull String token,
        @NonNull String role,
        @NonNull String username,
        long expiresInMs
) {}

package com.ledgerline.dto;

import com.ledgerline.model.Role;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

/**
 * Response body for POST /api/auth/register.
 * Returns the newly created user and their automatically provisioned account.
 *
 * @param userId        the new user's surrogate ID
 * @param username      the new user's login name
 * @param role          assigned role (always HOLDER for self-registered users)
 * @param fullName      the user's display name
 * @param token         signed JWT for immediate use
 * @param accountId     the auto-provisioned account's surrogate ID
 * @param accountNumber the auto-provisioned account's human-readable number (e.g. "ACC-1042")
 */
public record RegisterResponse(
        @Nullable Long userId,
        @NonNull String username,
        @NonNull Role role,
        @Nullable String fullName,
        @NonNull String token,
        @Nullable Long accountId,
        @NonNull String accountNumber
) {}

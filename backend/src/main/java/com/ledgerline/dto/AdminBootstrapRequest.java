package com.ledgerline.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

/**
 * Request body for POST /api/auth/bootstrap-admin.
 * Establishes the first system administrator account; guarded by a shared secret.
 *
 * @param bootstrapSecret shared secret to authorize admin creation (env: ADMIN_BOOTSTRAP_SECRET)
 * @param username        desired admin username
 * @param password        desired admin password (BCrypt-hashed server-side)
 * @param fullName        optional display name for the admin
 */
public record AdminBootstrapRequest(
        @NotBlank(message = "Bootstrap secret token is required")
        @NonNull String bootstrapSecret,

        @NotBlank(message = "Admin username is required")
        @Size(min = 3, max = 30)
        @NonNull String username,

        @NotBlank(message = "Admin password is required")
        @Size(min = 8, max = 100)
        @NonNull String password,

        @Nullable String fullName
) {}

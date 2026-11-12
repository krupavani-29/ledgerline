package com.ledgerline.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

/**
 * Request body for POST /api/auth/register (self-service account holder onboarding).
 *
 * @param username  unique login name; 3–30 chars; alphanumeric, underscore, hyphen only
 * @param password  plaintext password (BCrypt-hashed server-side); min 8 chars
 * @param fullName  display name shown on statements and audit log
 * @param email     optional contact email address
 * @param phone     optional contact phone number
 */
public record RegisterRequest(
        @NotBlank(message = "Username is required")
        @Size(min = 3, max = 30, message = "Username must be between 3 and 30 characters")
        @Pattern(regexp = "^[a-zA-Z0-9_-]+$", message = "Username must contain only letters, numbers, underscores, or hyphens")
        @NonNull String username,

        @NotBlank(message = "Password is required")
        @Size(min = 8, max = 100, message = "Password must be at least 8 characters long")
        @NonNull String password,

        @NotBlank(message = "Full name is required")
        @Size(max = 100, message = "Full name cannot exceed 100 characters")
        @NonNull String fullName,

        @Nullable String email,
        @Nullable String phone
) {}

package com.ledgerline.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminBootstrapRequest(
        @NotBlank(message = "Bootstrap secret token is required")
        String bootstrapSecret,

        @NotBlank(message = "Admin username is required")
        @Size(min = 3, max = 30)
        String username,

        @NotBlank(message = "Admin password is required")
        @Size(min = 8, max = 100)
        String password,

        String fullName
) {}


package com.ledgerline.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ledgerline.dto.ApiError;
import com.ledgerline.service.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Returns a uniform JSON 401 response when a request has a missing, expired, or invalid JWT token.
 * <p>
 * Per AGENTS.md Rule 10: no HTML error pages, no stack traces, no WWW-Authenticate headers
 * that could reveal internal implementation details.
 * Per AGENTS.md Rule 9: every 401 unauthenticated attempt is recorded in the audit log.
 */
@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AuditService auditService;

    public RestAuthenticationEntryPoint(@NonNull AuditService auditService) {
        this.auditService = auditService;
    }

    @Override
    public void commence(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull AuthenticationException authException
    ) throws IOException {
        String ipAddress = request.getHeader("X-Forwarded-For");
        if (ipAddress == null || ipAddress.isBlank()) {
            ipAddress = request.getRemoteAddr();
        }

        auditService.logEvent(
                "anonymous",
                "ANONYMOUS",
                "ACCESS_DENIED_401",
                request.getRequestURI(),
                "DENIED",
                ipAddress,
                authException.getMessage()
        );

        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        objectMapper.writeValue(
                response.getOutputStream(),
                ApiError.of("UNAUTHORIZED", "Authentication required or token is invalid/expired")
        );
    }
}

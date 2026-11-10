package com.ledgerline.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ledgerline.dto.ApiError;
import com.ledgerline.service.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

// AGENTS.md Rule 10: Uniform JSON errors {code, message, traceId}. Never leak stack traces or HTML errors.
// Security Decision: Missing, expired, or invalid JWT tokens return a consistent 401 JSON body.
@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AuditService auditService;

    public RestAuthenticationEntryPoint(AuditService auditService) {
        this.auditService = auditService;
    }

    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
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

        ApiError error = ApiError.of("UNAUTHORIZED", "Authentication required or token is invalid/expired");
        objectMapper.writeValue(response.getOutputStream(), error);
    }
}


package com.ledgerline;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ledgerline.dto.LoginRequest;
import com.ledgerline.model.Role;
import com.ledgerline.security.JwtService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// THREATS.md #6: Forged/expired JWT -> Signature + expiry validation -> AuthIT
// THREATS.md #9: Brute-force / Bad credentials -> AuthIT
public class AuthIT extends BaseIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtService jwtService;

    @Test
    @DisplayName("Threat 6: Missing JWT header on protected endpoint returns uniform 401 JSON")
    void missingJwt_returns401() throws Exception {
        mockMvc.perform(get("/api/accounts"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code", is("UNAUTHORIZED")))
                .andExpect(jsonPath("$.message", notNullValue()))
                .andExpect(jsonPath("$.traceId", notNullValue()));
    }

    @Test
    @DisplayName("Threat 6: Expired JWT token returns uniform 401 JSON")
    void expiredJwt_returns401() throws Exception {
        // Construct an already-expired JWT token
        String expiredToken = Jwts.builder()
                .subject("asha")
                .claim("role", "HOLDER")
                .claim("userId", 2L)
                .issuedAt(new Date(System.currentTimeMillis() - 2000000))
                .expiration(new Date(System.currentTimeMillis() - 1000000))
                .signWith(Keys.hmacShaKeyFor("test-secret-key-that-is-at-least-256-bits-long-for-hmac-sha-signing-tests".getBytes(StandardCharsets.UTF_8)))
                .compact();

        mockMvc.perform(get("/api/accounts")
                        .header("Authorization", "Bearer " + expiredToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code", is("UNAUTHORIZED")))
                .andExpect(jsonPath("$.traceId", notNullValue()));
    }

    @Test
    @DisplayName("Threat 6: Tampered JWT token signature returns uniform 401 JSON")
    void tamperedJwt_returns401() throws Exception {
        String validToken = jwtService.generateToken("asha", Role.HOLDER, 2L);
        // Tamper with token payload/signature
        String tamperedToken = validToken.substring(0, validToken.length() - 6) + "TAMPER";

        mockMvc.perform(get("/api/accounts")
                        .header("Authorization", "Bearer " + tamperedToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code", is("UNAUTHORIZED")))
                .andExpect(jsonPath("$.traceId", notNullValue()));
    }

    @Test
    @DisplayName("Valid credentials return 200 with JWT token and role claims")
    void validLogin_returnsToken() throws Exception {
        LoginRequest request = new LoginRequest("asha", "Password@123");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token", notNullValue()))
                .andExpect(jsonPath("$.role", is("HOLDER")))
                .andExpect(jsonPath("$.username", is("asha")))
                .andExpect(jsonPath("$.expiresInMs", is(900000)));
    }

    @Test
    @DisplayName("Invalid password returns uniform 401 JSON")
    void invalidPassword_returns401() throws Exception {
        LoginRequest request = new LoginRequest("asha", "WrongPassword!");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code", is("INVALID_CREDENTIALS")))
                .andExpect(jsonPath("$.traceId", notNullValue()));
    }
}


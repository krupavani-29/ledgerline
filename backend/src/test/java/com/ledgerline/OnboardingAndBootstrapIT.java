package com.ledgerline;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ledgerline.exception.RateLimitExceededException;
import com.ledgerline.security.RateLimitService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OnboardingAndBootstrapIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RateLimitService rateLimitService;

    @Test
    @DisplayName("BalanceVault Onboarding: Self-service registration creates HOLDER and auto-provisions 0-balance account")
    void register_createsHolderAndProvisionsAccount() throws Exception {
        String uniqueUser = "user_" + UUID.randomUUID().toString().substring(0, 8);
        String body = """
                {
                    "username": "%s",
                    "password": "Password@123",
                    "fullName": "Test New Holder",
                    "email": "%s@test.com"
                }
                """.formatted(uniqueUser, uniqueUser);

        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value(uniqueUser))
                .andExpect(jsonPath("$.role").value("HOLDER"))
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.accountNumber").isString())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        String token = json.get("token").asText();
        Long accountId = json.get("accountId").asLong();

        // Verify the newly registered user can immediately query their provisioned account
        mockMvc.perform(get("/api/accounts/" + accountId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.balance").value(0))
                .andExpect(jsonPath("$.currency").value("INR"));
    }

    @Test
    @DisplayName("BalanceVault Onboarding: Duplicate username registration is rejected with 400")
    void register_rejectsDuplicateUsername() throws Exception {
        String body = """
                {
                    "username": "asha",
                    "password": "Password@123",
                    "fullName": "Duplicate Asha"
                }
                """;

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    @DisplayName("BalanceVault First-Admin Bootstrap: Valid secret token establishes admin")
    void bootstrapAdmin_validSecret_succeeds() throws Exception {
        String body = """
                {
                    "bootstrapSecret": "balancevault-bootstrap-secret",
                    "username": "bootstrap_admin",
                    "password": "Password@123",
                    "fullName": "Bootstrap Administrator"
                }
                """;

        mockMvc.perform(post("/api/auth/bootstrap-admin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.username").value("bootstrap_admin"))
                .andExpect(jsonPath("$.token").isString());
    }

    @Test
    @DisplayName("BalanceVault First-Admin Bootstrap: Invalid secret token returns 403 Forbidden")
    void bootstrapAdmin_invalidSecret_returns403() throws Exception {
        String body = """
                {
                    "bootstrapSecret": "wrong-secret-token",
                    "username": "fake_admin",
                    "password": "Password@123",
                    "fullName": "Fake Admin"
                }
                """;

        mockMvc.perform(post("/api/auth/bootstrap-admin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    @DisplayName("Deployment Health Checks: /api/health, /liveness, and /readiness return 200 UP & READY")
    void healthChecks_allReturn200() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("BalanceVault Financial Engine"));

        mockMvc.perform(get("/api/health/liveness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));

        mockMvc.perform(get("/api/health/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.database").value("CONNECTED"));
    }

    @Test
    @DisplayName("Rate Limiting: Exceeding sliding window request limit triggers 429 Too Many Requests")
    void rateLimiting_exceedingLimit_triggers429() {
        String testKey = "test:ip-127-0-0-1-" + UUID.randomUUID();
        // Consume up to limit of 3 requests in 10-second window
        rateLimitService.checkRateLimit(testKey, 3, 10);
        rateLimitService.checkRateLimit(testKey, 3, 10);
        rateLimitService.checkRateLimit(testKey, 3, 10);

        // 4th request must trigger RateLimitExceededException
        assertThrows(RateLimitExceededException.class, () -> {
            rateLimitService.checkRateLimit(testKey, 3, 10);
        });
    }
}


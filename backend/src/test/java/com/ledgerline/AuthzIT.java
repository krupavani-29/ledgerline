package com.ledgerline;

import com.ledgerline.model.Role;
import com.ledgerline.security.JwtService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// THREATS.md #4 & #5: Horizontal & Vertical Role Escalation + Broken Object-Level Authorization (IDOR)
// AGENTS.md Rule 7: Mass-assignment protection (client balance ignored)
// AGENTS.md Rule 8: Server-side RBAC, foreign account returns 404 to prevent enumeration
public class AuthzIT extends BaseIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Test
    @DisplayName("BRIEF.md M1 / Threat 5: Auditor attempting write endpoint returns uniform 403 JSON")
    void auditorOnWrite_returns403() throws Exception {
        String auditorToken = jwtService.generateToken("auditor", Role.AUDITOR, 4L);

        mockMvc.perform(post("/api/accounts")
                        .header("Authorization", "Bearer " + auditorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\": 2}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code", is("FORBIDDEN")))
                .andExpect(jsonPath("$.message", notNullValue()))
                .andExpect(jsonPath("$.traceId", notNullValue()));
    }

    @Test
    @DisplayName("BRIEF.md M2 / Threat 4: Holder reading own account returns 200 OK")
    void holderReadingOwnAccount_returns200() throws Exception {
        String ashaToken = jwtService.generateToken("asha", Role.HOLDER, 2L);

        // Account 2 belongs to Asha (seed data)
        mockMvc.perform(get("/api/accounts/2")
                        .header("Authorization", "Bearer " + ashaToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(2)))
                .andExpect(jsonPath("$.accountNumber", is("ACC-1042")))
                .andExpect(jsonPath("$.userId", is(2)))
                .andExpect(jsonPath("$.balance").isNumber());
    }

    @Test
    @DisplayName("BRIEF.md M2 / Threat 4: Holder A reading Holder B's foreign account returns 404 (prevent IDOR & enumeration)")
    void holderReadingForeignAccount_returns404() throws Exception {
        String ashaToken = jwtService.generateToken("asha", Role.HOLDER, 2L);

        // Account 3 belongs to Ravi; Asha must receive 404, NOT 403 (AGENTS.md Rule 8)
        mockMvc.perform(get("/api/accounts/3")
                        .header("Authorization", "Bearer " + ashaToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is("NOT_FOUND")))
                .andExpect(jsonPath("$.message", containsString("Account not found")))
                .andExpect(jsonPath("$.traceId", notNullValue()));
    }

    @Test
    @DisplayName("BRIEF.md M2: GET /api/accounts returns only current holder's accounts")
    void holderListingAccounts_returnsOnlyOwnAccounts() throws Exception {
        String ashaToken = jwtService.generateToken("asha", Role.HOLDER, 2L);

        mockMvc.perform(get("/api/accounts")
                        .header("Authorization", "Bearer " + ashaToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].accountNumber", is("ACC-1042")));
    }

    @Test
    @DisplayName("BRIEF.md M2 / Threat 5: Holder attempting to create account returns 403 Forbidden")
    void holderCreatingAccount_returns403() throws Exception {
        String ashaToken = jwtService.generateToken("asha", Role.HOLDER, 2L);

        mockMvc.perform(post("/api/accounts")
                        .header("Authorization", "Bearer " + ashaToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\": 2}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code", is("FORBIDDEN")));
    }

    @Test
    @DisplayName("BRIEF.md M2 / Threat 5: Admin creates account, client-supplied balance is ignored (set to 0)")
    void adminCreatingAccount_ignoresClientSuppliedBalance() throws Exception {
        String adminToken = jwtService.generateToken("admin", Role.ADMIN, 1L);

        // Admin injects a massive balance attempt in body
        String requestBody = """
                {
                    "userId": 2,
                    "currency": "INR",
                    "balance": 999999999
                }
                """;

        mockMvc.perform(post("/api/accounts")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.userId", is(2)))
                .andExpect(jsonPath("$.balance", is(0))) // Balance must strictly be 0 minor units
                .andExpect(jsonPath("$.currency", is("INR")));
    }
}

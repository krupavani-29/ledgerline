package com.ledgerline;

import com.ledgerline.model.Role;
import com.ledgerline.security.JwtService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// THREATS.md #4: Auditor or holder escalates -> @PreAuthorize + service checks -> AuthzIT
// AGENTS.md Rule 8 & BRIEF.md M1: Auditor on write => 403
public class AuthzIT extends BaseIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Test
    @DisplayName("BRIEF.md M1 / Threat 4: Auditor attempting write endpoint returns uniform 403 JSON")
    void auditorOnWrite_returns403() throws Exception {
        String auditorToken = jwtService.generateToken("auditor", Role.AUDITOR, 4L);

        // Auditor attempts to post to a write endpoint (/api/accounts)
        mockMvc.perform(post("/api/accounts")
                        .header("Authorization", "Bearer " + auditorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code", is("FORBIDDEN")))
                .andExpect(jsonPath("$.message", notNullValue()))
                .andExpect(jsonPath("$.traceId", notNullValue()));
    }
}


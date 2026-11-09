package com.ledgerline;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ledgerline.model.Account;
import com.ledgerline.model.Role;
import com.ledgerline.repository.AccountRepository;
import com.ledgerline.repository.LedgerEntryRepository;
import com.ledgerline.repository.TransactionRepository;
import com.ledgerline.security.JwtService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// THREAT-01 (Race conditions / double-spending)
// THREAT-02 (Replay attacks / duplicate execution)
// THREAT-03 (Idempotency key hijacking)
// THREAT-04 (IDOR / BOLA)
// THREAT-06 (Negative balances & integer underflow)
// THREAT-08 (Double-entry conservation / sum = 0)
public class MoneyEngineIT extends BaseIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private LedgerEntryRepository ledgerEntryRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("BRIEF.md M3 / Threat 6: Rejects amount <= 0, > 100000000, or missing Idempotency-Key")
    void inputValidation_rejectsInvalidAmountsAndMissingHeader() throws Exception {
        String ashaToken = jwtService.generateToken("asha", Role.HOLDER, 2L);

        // Missing Idempotency-Key
        mockMvc.perform(post("/api/deposits")
                        .header("Authorization", "Bearer " + ashaToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\": 2, \"amount\": 1000}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("BAD_REQUEST")));

        // Amount <= 0
        mockMvc.perform(post("/api/deposits")
                        .header("Authorization", "Bearer " + ashaToken)
                        .header("Idempotency-Key", "key-zero-amount")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\": 2, \"amount\": 0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("BAD_REQUEST")));

        // Negative amount
        mockMvc.perform(post("/api/withdrawals")
                        .header("Authorization", "Bearer " + ashaToken)
                        .header("Idempotency-Key", "key-neg-amount")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\": 2, \"amount\": -500}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("BAD_REQUEST")));

        // Amount > 100000000 (100 million paise)
        mockMvc.perform(post("/api/deposits")
                        .header("Authorization", "Bearer " + ashaToken)
                        .header("Idempotency-Key", "key-over-limit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\": 2, \"amount\": 100000001}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("BAD_REQUEST")));
    }

    @Test
    @DisplayName("BRIEF.md M3 / Threat 4: Reject self-transfer and reject transfer from non-owned account (404)")
    void transferValidation_rejectsSelfTransferAndForeignAccount() throws Exception {
        String ashaToken = jwtService.generateToken("asha", Role.HOLDER, 2L);

        // Self-transfer (2 -> 2)
        mockMvc.perform(post("/api/transfers")
                        .header("Authorization", "Bearer " + ashaToken)
                        .header("Idempotency-Key", "key-self-transfer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sourceAccountId\": 2, \"targetAccountId\": 2, \"amount\": 5000}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("BAD_REQUEST")))
                .andExpect(jsonPath("$.message", containsString("Self-transfer is not permitted")));

        // Asha attempting to transfer from Ravi's account (Account 3 -> Account 2)
        // Must return 404 (AGENTS.md Rule 8) to prevent IDOR and account enumeration
        mockMvc.perform(post("/api/transfers")
                        .header("Authorization", "Bearer " + ashaToken)
                        .header("Idempotency-Key", "key-idor-transfer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sourceAccountId\": 3, \"targetAccountId\": 2, \"amount\": 5000}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is("NOT_FOUND")));
    }

    @Test
    @DisplayName("BRIEF.md M3 / Threat 3: Same Idempotency-Key + different payload returns HTTP 422")
    void sameKeyWithDifferentPayload_returns422() throws Exception {
        String ashaToken = jwtService.generateToken("asha", Role.HOLDER, 2L);
        String sharedKey = "idempotency-key-test-" + UUID.randomUUID();

        // 1. Initial successful deposit of 1000 paise
        mockMvc.perform(post("/api/deposits")
                        .header("Authorization", "Bearer " + ashaToken)
                        .header("Idempotency-Key", sharedKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\": 2, \"amount\": 1000}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.amount", is(1000)));

        // 2. Replay with the same key but different amount (2000 paise) -> 422 Unprocessable Entity
        mockMvc.perform(post("/api/deposits")
                        .header("Authorization", "Bearer " + ashaToken)
                        .header("Idempotency-Key", sharedKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\": 2, \"amount\": 2000}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code", is("UNPROCESSABLE_ENTITY")))
                .andExpect(jsonPath("$.message", containsString("different request payload")));
    }

    @Test
    @DisplayName("BRIEF.md M3 / Threat 2: Same Idempotency-Key x20 parallel requests returns exactly one transaction")
    void sameKeyX20Parallel_returnsExactlyOneTransaction() throws Exception {
        String raviToken = jwtService.generateToken("ravi", Role.HOLDER, 3L);
        String sharedKey = "idempotency-parallel-key-" + UUID.randomUUID();

        int threads = 20;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch readyLatch = new CountDownLatch(threads);
        CountDownLatch startLatch = new CountDownLatch(1);
        List<MvcResult> results = Collections.synchronizedList(new ArrayList<>());
        AtomicInteger successCount = new AtomicInteger();

        for (int i = 0; i < threads; i++) {
            executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await();
                    MvcResult result = mockMvc.perform(post("/api/withdrawals")
                                    .header("Authorization", "Bearer " + raviToken)
                                    .header("Idempotency-Key", sharedKey)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("{\"accountId\": 3, \"amount\": 10000}"))
                            .andReturn();
                    results.add(result);
                    int status = result.getResponse().getStatus();
                    if (status == 201 || status == 200) {
                        successCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            });
        }

        readyLatch.await();
        startLatch.countDown(); // Fire all 20 threads simultaneously
        executor.shutdown();
        assertTrue(executor.awaitTermination(30, TimeUnit.SECONDS));

        // All 20 calls return 201/200 with the exact same transaction ID
        assertEquals(20, results.size());
        assertEquals(20, successCount.get());

        String firstTxId = null;
        for (MvcResult res : results) {
            JsonNode node = objectMapper.readTree(res.getResponse().getContentAsString());
            String txId = node.get("transactionId").asText();
            if (firstTxId == null) {
                firstTxId = txId;
            } else {
                assertEquals(firstTxId, txId, "All parallel requests must replay the exact same transaction ID");
            }
        }
    }

    @Test
    @DisplayName("BRIEF.md M3 / Threat 1: 50 parallel withdrawals never go negative under concurrent load")
    void fiftyParallelWithdrawals_neverGoNegative() throws Exception {
        String ashaToken = jwtService.generateToken("asha", Role.HOLDER, 2L);

        // Fetch current Asha balance
        Account initialAsha = accountRepository.findById(2L).orElseThrow();
        long initialBalance = initialAsha.getBalance();
        assertTrue(initialBalance > 0);

        // Set withdrawal amount such that 50 requests attempt more than available balance
        // E.g. If balance is ~4,800,000, attempt 50 withdrawals of 100,000 each = 5,000,000 total attempted
        long withdrawalAmount = 100_000L;
        int totalRequests = 50;

        ExecutorService executor = Executors.newFixedThreadPool(totalRequests);
        CountDownLatch readyLatch = new CountDownLatch(totalRequests);
        CountDownLatch startLatch = new CountDownLatch(1);
        AtomicInteger successfulDebits = new AtomicInteger();
        AtomicInteger rejectedInsufficient = new AtomicInteger();

        for (int i = 0; i < totalRequests; i++) {
            final String uniqueKey = "parallel-withdrawal-" + i + "-" + UUID.randomUUID();
            executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await();
                    MvcResult res = mockMvc.perform(post("/api/withdrawals")
                                    .header("Authorization", "Bearer " + ashaToken)
                                    .header("Idempotency-Key", uniqueKey)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("{\"accountId\": 2, \"amount\": " + withdrawalAmount + "}"))
                            .andReturn();

                    int status = res.getResponse().getStatus();
                    if (status == 201) {
                        successfulDebits.incrementAndGet();
                    } else if (status == 400) {
                        rejectedInsufficient.incrementAndGet();
                    }
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            });
        }

        readyLatch.await();
        startLatch.countDown(); // Fire all 50 threads simultaneously
        executor.shutdown();
        assertTrue(executor.awaitTermination(25, TimeUnit.SECONDS));

        // Total executed requests should equal 50
        assertEquals(totalRequests, successfulDebits.get() + rejectedInsufficient.get());

        // Refresh Asha's account balance directly from DB
        Account finalAsha = accountRepository.findById(2L).orElseThrow();
        long expectedFinalBalance = initialBalance - (successfulDebits.get() * withdrawalAmount);

        assertEquals(expectedFinalBalance, finalAsha.getBalance());
        assertTrue(finalAsha.getBalance() >= 0, "Account balance must strictly NEVER go negative! Final: " + finalAsha.getBalance());
    }

    @Test
    @DisplayName("BRIEF.md M3 / Threat 8: Double-entry ledger sums to exactly 0 across all entries")
    void ledgerConservation_sumsToZero() {
        Long totalLedgerSum = ledgerEntryRepository.sumAllAmounts();
        assertEquals(0L, totalLedgerSum, "Total sum of all double-entry ledger entries in the entire system must be strictly 0");
    }
}


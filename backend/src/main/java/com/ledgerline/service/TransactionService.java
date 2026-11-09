package com.ledgerline.service;

import com.ledgerline.dto.DepositRequest;
import com.ledgerline.dto.TransactionReceipt;
import com.ledgerline.dto.TransferRequest;
import com.ledgerline.dto.WithdrawalRequest;
import com.ledgerline.exception.InvalidTransactionException;
import com.ledgerline.exception.ResourceNotFoundException;
import com.ledgerline.model.User;
import com.ledgerline.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Objects;

@Service
public class TransactionService {

    private static final long MAX_TRANSACTION_AMOUNT = 100_000_000L; // 100 million paise = ₹1,000,000.00 (BRIEF.md M3)

    private final UserRepository userRepository;
    private final IdempotencyService idempotencyService;
    private final LedgerPostingService ledgerPostingService;

    public TransactionService(
            UserRepository userRepository,
            IdempotencyService idempotencyService,
            LedgerPostingService ledgerPostingService
    ) {
        this.userRepository = userRepository;
        this.idempotencyService = idempotencyService;
        this.ledgerPostingService = ledgerPostingService;
    }

    // =========================================================================
    // DEPOSIT
    // =========================================================================
    public TransactionReceipt deposit(String username, String idempotencyKey, DepositRequest request) {
        validateIdempotencyKey(idempotencyKey);
        validateAmount(request.amount());
        User user = getUser(username);

        String requestHash = computeHash("/api/deposits", request.accountId(), null, request.amount());
        boolean claimed = idempotencyService.claimKey(user.getId(), idempotencyKey, requestHash);
        if (!claimed) {
            return idempotencyService.handleExistingKey(user.getId(), idempotencyKey, requestHash);
        }

        return ledgerPostingService.executeDeposit(user, idempotencyKey, request);
    }

    // =========================================================================
    // WITHDRAWAL
    // =========================================================================
    public TransactionReceipt withdraw(String username, String idempotencyKey, WithdrawalRequest request) {
        validateIdempotencyKey(idempotencyKey);
        validateAmount(request.amount());
        User user = getUser(username);

        String requestHash = computeHash("/api/withdrawals", request.accountId(), null, request.amount());
        boolean claimed = idempotencyService.claimKey(user.getId(), idempotencyKey, requestHash);
        if (!claimed) {
            return idempotencyService.handleExistingKey(user.getId(), idempotencyKey, requestHash);
        }

        return ledgerPostingService.executeWithdrawal(user, idempotencyKey, request);
    }

    // =========================================================================
    // TRANSFER
    // =========================================================================
    public TransactionReceipt transfer(String username, String idempotencyKey, TransferRequest request) {
        validateIdempotencyKey(idempotencyKey);
        validateAmount(request.amount());
        if (Objects.equals(request.sourceAccountId(), request.targetAccountId())) {
            throw new InvalidTransactionException("Self-transfer is not permitted");
        }

        User user = getUser(username);

        String requestHash = computeHash("/api/transfers", request.sourceAccountId(), request.targetAccountId(), request.amount());
        boolean claimed = idempotencyService.claimKey(user.getId(), idempotencyKey, requestHash);
        if (!claimed) {
            return idempotencyService.handleExistingKey(user.getId(), idempotencyKey, requestHash);
        }

        return ledgerPostingService.executeTransfer(user, idempotencyKey, request);
    }

    private void validateIdempotencyKey(String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new InvalidTransactionException("Idempotency-Key header is required");
        }
    }

    private void validateAmount(Long amount) {
        if (amount == null || amount <= 0 || amount > MAX_TRANSACTION_AMOUNT) {
            throw new InvalidTransactionException("Amount must be between 1 and " + MAX_TRANSACTION_AMOUNT + " paise");
        }
    }

    private User getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));
    }

    private String computeHash(String endpoint, Long sourceId, Long targetId, Long amount) {
        String raw = endpoint + "|" + sourceId + "|" + targetId + "|" + amount;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                String h = Integer.toHexString(0xff & b);
                if (h.length() == 1) hex.append('0');
                hex.append(h);
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm unavailable", e);
        }
    }
}

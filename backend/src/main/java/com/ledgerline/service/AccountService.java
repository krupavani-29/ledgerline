package com.ledgerline.service;

import com.ledgerline.dto.AccountResponse;
import com.ledgerline.dto.CreateAccountRequest;
import com.ledgerline.exception.ResourceNotFoundException;
import com.ledgerline.model.Account;
import com.ledgerline.model.Role;
import com.ledgerline.model.User;
import com.ledgerline.repository.AccountRepository;
import com.ledgerline.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
import java.util.Objects;

@Service
public class AccountService {

    private final AccountRepository accountRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;
    private final SecureRandom random = new SecureRandom();

    public AccountService(AccountRepository accountRepository, UserRepository userRepository, AuditService auditService) {
        this.accountRepository = accountRepository;
        this.userRepository = userRepository;
        this.auditService = auditService;
    }

    // Security Decision: Identity is derived strictly from the authenticated JWT subject (Rule 7).
    // HOLDER users only receive their own accounts. ADMIN and AUDITOR can inspect all accounts (Rule 8).
    @Transactional(readOnly = true)
    public List<AccountResponse> getAccountsForCurrentUser(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));

        List<Account> accounts;
        if (user.getRole() == Role.HOLDER) {
            accounts = accountRepository.findByUserId(user.getId());
        } else {
            accounts = accountRepository.findAll();
        }

        return accounts.stream().map(AccountResponse::from).toList();
    }

    // Security Decision (AGENTS.md Rule 8 & Threat 3):
    // When a HOLDER requests an account belonging to someone else, we return 404 (Not Found) rather than 403 (Forbidden).
    // This prevents attacker enumeration: an unauthorized user cannot determine whether a foreign account ID exists.
    @Transactional(readOnly = true)
    public AccountResponse getAccountById(Long accountId, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));

        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found: " + accountId));

        if (user.getRole() == Role.HOLDER && !Objects.equals(account.getUserId(), user.getId())) {
            auditService.logEvent(
                    user.getUsername(),
                    user.getRole().name(),
                    "ACCOUNT_ACCESS_DENIED",
                    "/api/accounts/" + accountId,
                    "DENIED",
                    null,
                    "Unauthorized account read attempt: account " + accountId + " by " + username
            );
            throw new ResourceNotFoundException("Account not found: " + accountId);
        }

        return AccountResponse.from(account);
    }

    // Security Decision (AGENTS.md Rule 1 & Rule 7):
    // Accounts are always initialized with 0 balance. Money can only enter via double-entry ledger transactions (Module 3).
    // Client-supplied balance fields are discarded to prevent mass-assignment exploits (Threat 5).
    @Transactional
    public AccountResponse createAccount(CreateAccountRequest request) {
        User targetUser = userRepository.findById(request.userId())
                .orElseThrow(() -> new ResourceNotFoundException("Target user not found: " + request.userId()));

        String accountNumber;
        do {
            accountNumber = "ACC-" + (1000 + random.nextInt(9000));
        } while (accountRepository.findByAccountNumber(accountNumber).isPresent());

        String currency = (request.currency() != null && !request.currency().isBlank()) ? request.currency().trim().toUpperCase() : "INR";

        Account account = new Account(
                accountNumber,
                targetUser.getId(),
                false,
                0L, // Initial balance is strictly 0 minor units (Rule 7)
                currency
        );

        Account saved = accountRepository.save(account);
        return AccountResponse.from(saved);
    }
}


package com.ledgerline.service;

import com.ledgerline.dto.DepositRequest;
import com.ledgerline.dto.TransactionReceipt;
import com.ledgerline.dto.TransferRequest;
import com.ledgerline.dto.WithdrawalRequest;
import com.ledgerline.exception.InsufficientFundsException;
import com.ledgerline.exception.ResourceNotFoundException;
import com.ledgerline.model.*;
import com.ledgerline.repository.AccountRepository;
import com.ledgerline.repository.LedgerEntryRepository;
import com.ledgerline.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Stream;

@Service
public class LedgerPostingService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final IdempotencyService idempotencyService;
    private final AuditService auditService;

    public LedgerPostingService(
            AccountRepository accountRepository,
            TransactionRepository transactionRepository,
            LedgerEntryRepository ledgerEntryRepository,
            IdempotencyService idempotencyService,
            AuditService auditService
    ) {
        this.accountRepository = accountRepository;
        this.transactionRepository = transactionRepository;
        this.ledgerEntryRepository = ledgerEntryRepository;
        this.idempotencyService = idempotencyService;
        this.auditService = auditService;
    }

    // =========================================================================
    // EXECUTE DEPOSIT
    // =========================================================================
    // Security Decision (AGENTS.md Rule 3, 6, 8):
    // 1. Lock rows ordered by ID BEFORE balance read (Rule 6).
    // 2. Ownership verified on locked entity (Rule 8).
    // 3. Double-entry legs sum to exactly 0 (Rule 3).
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public TransactionReceipt executeDeposit(User user, String idempotencyKey, DepositRequest request) {
        Account systemCash = getSystemCashAccount();

        List<Long> lockOrder = Stream.of(request.accountId(), systemCash.getId()).sorted().toList();
        List<Account> locked = accountRepository.findAllByIdInOrderByIdAscForUpdate(lockOrder);
        Account lockedUserAcc = findInList(locked, request.accountId());
        Account lockedSystemCash = findInList(locked, systemCash.getId());

        verifyAccountOwnership(lockedUserAcc, user);

        long newUserBalance = lockedUserAcc.getBalance() + request.amount();
        long newSystemBalance = lockedSystemCash.getBalance() - request.amount();

        lockedUserAcc.setBalance(newUserBalance);
        lockedSystemCash.setBalance(newSystemBalance);
        accountRepository.save(lockedUserAcc);
        accountRepository.save(lockedSystemCash);

        Transaction tx = transactionRepository.save(new Transaction(
                "tx-" + UUID.randomUUID(),
                TransactionType.DEPOSIT,
                request.description() != null ? request.description() : "Deposit"
        ));

        ledgerEntryRepository.save(new LedgerEntry(tx.getId(), lockedUserAcc.getId(), request.amount(), newUserBalance));
        ledgerEntryRepository.save(new LedgerEntry(tx.getId(), lockedSystemCash.getId(), -request.amount(), newSystemBalance));

        TransactionReceipt receipt = new TransactionReceipt(
                tx.getId(),
                tx.getReferenceId(),
                TransactionType.DEPOSIT,
                request.amount(),
                null,
                lockedUserAcc.getId(),
                tx.getDescription(),
                tx.getCreatedAt()
        );

        idempotencyService.recordSuccess(user.getId(), idempotencyKey, receipt);
        auditService.logEvent(
                user.getUsername(),
                user.getRole().name(),
                "MONEY_DEPOSIT",
                "/api/deposits",
                "SUCCESS",
                null,
                "Deposited " + request.amount() + " paise into account " + lockedUserAcc.getId() + " (tx: " + tx.getReferenceId() + ")"
        );
        return receipt;
    }

    // =========================================================================
    // EXECUTE WITHDRAWAL
    // =========================================================================
    // Security Decision (AGENTS.md Rule 4, 6, 8):
    // 1. Account row locked BEFORE balance inspection (Rule 6).
    // 2. Balance read strictly after lock acquisition, preventing TOCTOU races.
    // 3. Overdraft rejected by service AND guarded by DB constraint (Rule 4).
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public TransactionReceipt executeWithdrawal(User user, String idempotencyKey, WithdrawalRequest request) {
        Account systemCash = getSystemCashAccount();

        List<Long> lockOrder = Stream.of(request.accountId(), systemCash.getId()).sorted().toList();
        List<Account> locked = accountRepository.findAllByIdInOrderByIdAscForUpdate(lockOrder);
        Account lockedUserAcc = findInList(locked, request.accountId());
        Account lockedSystemCash = findInList(locked, systemCash.getId());

        verifyAccountOwnership(lockedUserAcc, user);

        if (lockedUserAcc.getBalance() < request.amount()) {
            auditService.logEvent(
                    user.getUsername(),
                    user.getRole().name(),
                    "MONEY_WITHDRAWAL",
                    "/api/withdrawals",
                    "FAILED",
                    null,
                    "Insufficient funds for account " + lockedUserAcc.getId() + ": available " + lockedUserAcc.getBalance() + " paise, requested " + request.amount() + " paise"
            );
            throw new InsufficientFundsException("Insufficient funds. Available: " + lockedUserAcc.getBalance() + " paise, requested: " + request.amount() + " paise");
        }

        long newUserBalance = lockedUserAcc.getBalance() - request.amount();
        long newSystemBalance = lockedSystemCash.getBalance() + request.amount();

        lockedUserAcc.setBalance(newUserBalance);
        lockedSystemCash.setBalance(newSystemBalance);
        accountRepository.save(lockedUserAcc);
        accountRepository.save(lockedSystemCash);

        Transaction tx = transactionRepository.save(new Transaction(
                "tx-" + UUID.randomUUID(),
                TransactionType.WITHDRAWAL,
                request.description() != null ? request.description() : "Withdrawal"
        ));

        ledgerEntryRepository.save(new LedgerEntry(tx.getId(), lockedUserAcc.getId(), -request.amount(), newUserBalance));
        ledgerEntryRepository.save(new LedgerEntry(tx.getId(), lockedSystemCash.getId(), request.amount(), newSystemBalance));

        TransactionReceipt receipt = new TransactionReceipt(
                tx.getId(),
                tx.getReferenceId(),
                TransactionType.WITHDRAWAL,
                request.amount(),
                lockedUserAcc.getId(),
                null,
                tx.getDescription(),
                tx.getCreatedAt()
        );

        idempotencyService.recordSuccess(user.getId(), idempotencyKey, receipt);
        auditService.logEvent(
                user.getUsername(),
                user.getRole().name(),
                "MONEY_WITHDRAWAL",
                "/api/withdrawals",
                "SUCCESS",
                null,
                "Withdrew " + request.amount() + " paise from account " + lockedUserAcc.getId() + " (tx: " + tx.getReferenceId() + ")"
        );
        return receipt;
    }

    // =========================================================================
    // EXECUTE TRANSFER
    // =========================================================================
    // Security Decision (AGENTS.md Rule 3, 4, 6, 8):
    // 1. Both accounts locked in ascending ID order (ORDER BY id) to eliminate deadlocks.
    // 2. Source balance read strictly after acquiring exclusive row lock.
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public TransactionReceipt executeTransfer(User user, String idempotencyKey, TransferRequest request) {
        List<Long> lockOrder = Stream.of(request.sourceAccountId(), request.targetAccountId()).sorted().toList();
        List<Account> locked = accountRepository.findAllByIdInOrderByIdAscForUpdate(lockOrder);
        Account lockedSource = findInList(locked, request.sourceAccountId());
        Account lockedTarget = findInList(locked, request.targetAccountId());

        verifyAccountOwnership(lockedSource, user);

        if (lockedSource.getBalance() < request.amount()) {
            auditService.logEvent(
                    user.getUsername(),
                    user.getRole().name(),
                    "MONEY_TRANSFER",
                    "/api/transfers",
                    "FAILED",
                    null,
                    "Insufficient funds for transfer from account " + lockedSource.getId() + ": available " + lockedSource.getBalance() + " paise, requested " + request.amount() + " paise"
            );
            throw new InsufficientFundsException("Insufficient funds. Available: " + lockedSource.getBalance() + " paise, requested: " + request.amount() + " paise");
        }

        long newSourceBalance = lockedSource.getBalance() - request.amount();
        long newTargetBalance = lockedTarget.getBalance() + request.amount();

        lockedSource.setBalance(newSourceBalance);
        lockedTarget.setBalance(newTargetBalance);
        accountRepository.save(lockedSource);
        accountRepository.save(lockedTarget);

        Transaction tx = transactionRepository.save(new Transaction(
                "tx-" + UUID.randomUUID(),
                TransactionType.TRANSFER,
                request.description() != null ? request.description() : "Transfer"
        ));

        ledgerEntryRepository.save(new LedgerEntry(tx.getId(), lockedSource.getId(), -request.amount(), newSourceBalance));
        ledgerEntryRepository.save(new LedgerEntry(tx.getId(), lockedTarget.getId(), request.amount(), newTargetBalance));

        TransactionReceipt receipt = new TransactionReceipt(
                tx.getId(),
                tx.getReferenceId(),
                TransactionType.TRANSFER,
                request.amount(),
                lockedSource.getId(),
                lockedTarget.getId(),
                tx.getDescription(),
                tx.getCreatedAt()
        );

        idempotencyService.recordSuccess(user.getId(), idempotencyKey, receipt);
        auditService.logEvent(
                user.getUsername(),
                user.getRole().name(),
                "MONEY_TRANSFER",
                "/api/transfers",
                "SUCCESS",
                null,
                "Transferred " + request.amount() + " paise from account " + lockedSource.getId() + " to " + lockedTarget.getId() + " (tx: " + tx.getReferenceId() + ")"
        );
        return receipt;
    }

    private Account getSystemCashAccount() {
        return accountRepository.findFirstByIsSystemTrue()
                .orElseThrow(() -> new ResourceNotFoundException("System cash account not configured"));
    }

    private void verifyAccountOwnership(Account account, User user) {
        if (!Objects.equals(account.getUserId(), user.getId())) {
            auditService.logEvent(
                    user.getUsername(),
                    user.getRole().name(),
                    "ACCESS_DENIED_IDOR",
                    "/api/money",
                    "DENIED",
                    null,
                    "Unauthorized access attempt to account " + account.getId() + " by " + user.getUsername()
            );
            throw new ResourceNotFoundException("Account not found: " + account.getId());
        }
    }

    private Account findInList(List<Account> accounts, Long id) {
        return accounts.stream()
                .filter(a -> a.getId().equals(id))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Account not found: " + id));
    }
}


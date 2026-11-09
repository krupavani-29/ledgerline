package com.ledgerline.repository;

import com.ledgerline.model.LedgerEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, Long> {

    List<LedgerEntry> findByTransactionId(Long transactionId);

    List<LedgerEntry> findByAccountIdOrderByCreatedAtDesc(Long accountId);

    // AGENTS.md Rule 3: Verification of system-wide double-entry conservation (sum = 0)
    @Query("SELECT COALESCE(SUM(l.amount), 0) FROM LedgerEntry l")
    Long sumAllAmounts();

    @Query("SELECT COALESCE(SUM(l.amount), 0) FROM LedgerEntry l WHERE l.accountId = :accountId")
    Long sumAmountsByAccountId(@Param("accountId") Long accountId);
}


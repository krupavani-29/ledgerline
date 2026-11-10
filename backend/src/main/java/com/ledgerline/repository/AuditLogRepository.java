package com.ledgerline.repository;

import com.ledgerline.model.AuditLogEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLogEntry, Long> {

    Optional<AuditLogEntry> findTopByOrderBySequenceNumDesc();

    Page<AuditLogEntry> findAllByOrderBySequenceNumDesc(Pageable pageable);

    List<AuditLogEntry> findAllByOrderBySequenceNumAsc();
}


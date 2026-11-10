package com.ledgerline.security;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * AGENTS.md Rule 9 & BRIEF.md M4:
 * Automatically registers append-only triggers on H2 databases for testing parity with PostgreSQL.
 */
@Component
public class DatabaseTriggerInitializer {

    private static final Logger log = LoggerFactory.getLogger(DatabaseTriggerInitializer.class);
    private final DataSource dataSource;

    public DatabaseTriggerInitializer(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @PostConstruct
    public void initTriggers() {
        try (Connection conn = dataSource.getConnection()) {
            String dbProduct = conn.getMetaData().getDatabaseProductName();
            if (dbProduct != null && dbProduct.equalsIgnoreCase("H2")) {
                try (Statement stmt = conn.createStatement()) {
                    stmt.execute("CREATE TRIGGER IF NOT EXISTS trg_h2_ledger_entries_append_only " +
                                 "BEFORE UPDATE, DELETE ON ledger_entries FOR EACH ROW CALL \"com.ledgerline.security.H2AppendOnlyTrigger\"");
                    stmt.execute("CREATE TRIGGER IF NOT EXISTS trg_h2_audit_log_append_only " +
                                 "BEFORE UPDATE, DELETE ON audit_log FOR EACH ROW CALL \"com.ledgerline.security.H2AppendOnlyTrigger\"");
                    log.info("Initialized H2 append-only triggers for ledger_entries and audit_log");
                }
            }
        } catch (SQLException e) {
            log.warn("Could not register H2 append-only triggers: {}", e.getMessage());
        }
    }
}


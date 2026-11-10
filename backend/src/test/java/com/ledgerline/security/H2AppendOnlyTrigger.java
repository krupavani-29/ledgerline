package com.ledgerline.security;

import org.h2.api.Trigger;

import java.sql.Connection;
import java.sql.SQLException;

/**
 * AGENTS.md Rule 9 & BRIEF.md M4:
 * H2 Trigger to enforce append-only immutability on ledger_entries and audit_log in test environments.
 * Any UPDATE or DELETE operation fails with a SQL exception.
 */
public class H2AppendOnlyTrigger implements Trigger {

    @Override
    public void init(Connection conn, String schemaName, String triggerName, String tableName, boolean before, int type) throws SQLException {
        // No special initialization needed
    }

    @Override
    public void fire(Connection conn, Object[] oldRow, Object[] newRow) throws SQLException {
        throw new SQLException("Table is strictly append-only; UPDATE and DELETE operations are prohibited.");
    }

    @Override
    public void close() throws SQLException {
    }

    @Override
    public void remove() throws SQLException {
    }
}


package com.ledgerline.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.Instant;
import java.util.Map;

/**
 * BalanceVault / LedgerLine Deployment Health & Readiness Probes.
 * Used by orchestrators (Kubernetes / Render / Railway) to monitor uptime and DB connectivity.
 */
@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final DataSource dataSource;

    public HealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "BalanceVault Financial Engine",
                "version", "1.0.0",
                "timestamp", Instant.now().toString()
        ));
    }

    @GetMapping("/liveness")
    public ResponseEntity<Map<String, Object>> liveness() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "timestamp", Instant.now().toString()
        ));
    }

    @GetMapping("/readiness")
    public ResponseEntity<Map<String, Object>> readiness() {
        try (Connection conn = dataSource.getConnection()) {
            boolean valid = conn.isValid(2);
            if (valid) {
                return ResponseEntity.ok(Map.of(
                        "status", "READY",
                        "database", "CONNECTED",
                        "timestamp", Instant.now().toString()
                ));
            }
        } catch (Exception e) {
            // DB connection failed
        }

        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "status", "NOT_READY",
                "database", "DISCONNECTED",
                "timestamp", Instant.now().toString()
        ));
    }
}

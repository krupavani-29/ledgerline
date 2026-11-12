package com.ledgerline.model;

import jakarta.persistence.*;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

import java.time.Instant;

/**
 * Represents a registered user of the BalanceVault platform.
 * <p>
 * Passwords are always stored as BCrypt hashes; plaintext is never persisted.
 * Role determines RBAC permissions: ADMIN, HOLDER (account owner), or AUDITOR (read-only).
 */
@Entity
@Table(name = "users")
public class User {

    /** Auto-generated surrogate primary key. Null before first persistence. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Nullable
    private Long id;

    /** Unique login identifier. Stored and compared in lowercase. */
    @NonNull
    @Column(nullable = false, unique = true, length = 50)
    private String username = "";

    /** BCrypt-hashed password. Never the raw plaintext password. */
    @NonNull
    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash = "";

    /** Determines API access permissions: ADMIN, HOLDER, or AUDITOR. */
    @NonNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role = Role.HOLDER;

    /** Display name for the user. Optional; may be null. */
    @Nullable
    @Column(name = "full_name", length = 100)
    private String fullName;

    /** Timestamp when this user account was created. Immutable after insertion. */
    @NonNull
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    /** No-arg constructor required by JPA. */
    public User() {}

    /**
     * Creates a new user with all required fields.
     *
     * @param username     unique login name (lowercase)
     * @param passwordHash BCrypt-hashed password
     * @param role         RBAC role
     * @param fullName     optional display name
     */
    public User(
            @NonNull String username,
            @NonNull String passwordHash,
            @NonNull Role role,
            @Nullable String fullName
    ) {
        this.username = username;
        this.passwordHash = passwordHash;
        this.role = role;
        this.fullName = fullName;
        this.createdAt = Instant.now();
    }

    @Nullable
    public Long getId() { return id; }
    public void setId(@Nullable Long id) { this.id = id; }

    @NonNull
    public String getUsername() { return username; }
    public void setUsername(@NonNull String username) { this.username = username; }

    @NonNull
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(@NonNull String passwordHash) { this.passwordHash = passwordHash; }

    @NonNull
    public Role getRole() { return role; }
    public void setRole(@NonNull Role role) { this.role = role; }

    @Nullable
    public String getFullName() { return fullName; }
    public void setFullName(@Nullable String fullName) { this.fullName = fullName; }

    @NonNull
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(@NonNull Instant createdAt) { this.createdAt = createdAt; }
}

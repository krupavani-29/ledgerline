package com.ledgerline.controller;

import com.ledgerline.dto.*;
import com.ledgerline.exception.InvalidTransactionException;
import com.ledgerline.exception.ResourceNotFoundException;
import com.ledgerline.model.Account;
import com.ledgerline.model.Role;
import com.ledgerline.model.User;
import com.ledgerline.repository.AccountRepository;
import com.ledgerline.repository.UserRepository;
import com.ledgerline.security.JwtService;
import com.ledgerline.security.RateLimitService;
import com.ledgerline.service.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;

/**
 * BalanceVault / LedgerLine Authentication & Onboarding Controller.
 * Handles JWT logins, self-service account-holder onboarding, first-admin bootstrap, and IP rate limiting.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final RateLimitService rateLimitService;
    private final long expirationMs;
    private final String bootstrapSecret;
    private final SecureRandom random = new SecureRandom();

    public AuthController(
            AuthenticationManager authenticationManager,
            JwtService jwtService,
            UserRepository userRepository,
            AccountRepository accountRepository,
            PasswordEncoder passwordEncoder,
            AuditService auditService,
            RateLimitService rateLimitService,
            @Value("${jwt.expiration-ms:900000}") long expirationMs,
            @Value("${admin.bootstrap.secret:balancevault-bootstrap-secret}") String bootstrapSecret
    ) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.accountRepository = accountRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
        this.rateLimitService = rateLimitService;
        this.expirationMs = expirationMs;
        this.bootstrapSecret = bootstrapSecret;
    }

    // Security Decision: Rate limited to 20 attempts/minute per IP to prevent credential stuffing and brute force.
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        String clientIp = resolveClientIp(httpRequest);
        rateLimitService.checkRateLimit("login:" + clientIp, 20, 60);

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password())
        );

        User user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + request.username()));

        String token = jwtService.generateToken(user.getUsername(), user.getRole(), user.getId());

        auditService.logEvent(
                user.getUsername(),
                user.getRole().name(),
                "USER_LOGIN",
                "/api/auth/login",
                "SUCCESS",
                clientIp,
                "User successfully logged in"
        );

        return ResponseEntity.ok(new LoginResponse(
                token,
                user.getRole().name(),
                user.getUsername(),
                expirationMs
        ));
    }

    // BalanceVault Onboarding: Self-service registration for account holders.
    // Creates user record and automatically provisions their initial checking account with 0 paise.
    @PostMapping("/register")
    @Transactional
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest) {
        String clientIp = resolveClientIp(httpRequest);
        rateLimitService.checkRateLimit("register:" + clientIp, 10, 60);

        if (userRepository.findByUsername(request.username().trim().toLowerCase()).isPresent()) {
            throw new InvalidTransactionException("Username '" + request.username() + "' is already registered");
        }

        User newUser = new User(
                request.username().trim().toLowerCase(),
                passwordEncoder.encode(request.password()),
                Role.HOLDER,
                request.fullName().trim()
        );
        User savedUser = userRepository.save(newUser);

        // Provision initial account with unique account number
        String accountNumber;
        do {
            accountNumber = "ACC-" + (1000 + random.nextInt(9000));
        } while (accountRepository.findByAccountNumber(accountNumber).isPresent());

        Account account = new Account(
                accountNumber,
                savedUser.getId(),
                false,
                0L, // Initial balance is strictly 0 paise minor units
                "INR"
        );
        Account savedAccount = accountRepository.save(account);

        String token = jwtService.generateToken(savedUser.getUsername(), savedUser.getRole(), savedUser.getId());

        auditService.logEvent(
                savedUser.getUsername(),
                savedUser.getRole().name(),
                "USER_REGISTER",
                "/api/auth/register",
                "SUCCESS",
                clientIp,
                "Account holder registered; account " + savedAccount.getAccountNumber() + " created"
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(new RegisterResponse(
                savedUser.getId(),
                savedUser.getUsername(),
                savedUser.getRole(),
                savedUser.getFullName(),
                token,
                savedAccount.getId(),
                savedAccount.getAccountNumber()
        ));
    }

    // BalanceVault First-Admin Bootstrap: Securely establishes or resets the initial system administrator.
    @PostMapping("/bootstrap-admin")
    @Transactional
    public ResponseEntity<LoginResponse> bootstrapAdmin(@Valid @RequestBody AdminBootstrapRequest request, HttpServletRequest httpRequest) {
        String clientIp = resolveClientIp(httpRequest);

        boolean hasAdmin = userRepository.findAll().stream().anyMatch(u -> u.getRole() == Role.ADMIN);
        if (hasAdmin && !bootstrapSecret.equals(request.bootstrapSecret())) {
            throw new AccessDeniedException("Invalid bootstrap token. System administrator already exists.");
        }

        User adminUser = userRepository.findByUsername(request.username().trim().toLowerCase())
                .orElse(new User());

        adminUser.setUsername(request.username().trim().toLowerCase());
        adminUser.setPasswordHash(passwordEncoder.encode(request.password()));
        adminUser.setRole(Role.ADMIN);
        adminUser.setFullName(request.fullName() != null && !request.fullName().isBlank() ? request.fullName().trim() : "System Administrator");

        User saved = userRepository.save(adminUser);
        String token = jwtService.generateToken(saved.getUsername(), saved.getRole(), saved.getId());

        auditService.logEvent(
                saved.getUsername(),
                saved.getRole().name(),
                "ADMIN_BOOTSTRAP",
                "/api/auth/bootstrap-admin",
                "SUCCESS",
                clientIp,
                "Administrator bootstrap executed successfully"
        );

        return ResponseEntity.ok(new LoginResponse(
                token,
                saved.getRole().name(),
                saved.getUsername(),
                expirationMs
        ));
    }

    private String resolveClientIp(HttpServletRequest request) {
        String xForwarded = request.getHeader("X-Forwarded-For");
        if (xForwarded != null && !xForwarded.isBlank()) {
            return xForwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "127.0.0.1";
    }
}

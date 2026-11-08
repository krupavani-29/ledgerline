package com.ledgerline.controller;

import com.ledgerline.dto.LoginRequest;
import com.ledgerline.dto.LoginResponse;
import com.ledgerline.model.User;
import com.ledgerline.repository.UserRepository;
import com.ledgerline.security.JwtService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final long expirationMs;

    public AuthController(
            AuthenticationManager authenticationManager,
            JwtService jwtService,
            UserRepository userRepository,
            @Value("${jwt.expiration-ms:900000}") long expirationMs
    ) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.expirationMs = expirationMs;
    }

    // Security Decision: Authentication is handled by Spring Security DAO provider.
    // Passwords are verified against BCrypt hashes without ever being logged or exposed.
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password())
        );

        User user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + request.username()));

        String token = jwtService.generateToken(user.getUsername(), user.getRole(), user.getId());

        return ResponseEntity.ok(new LoginResponse(
                token,
                user.getRole().name(),
                user.getUsername(),
                expirationMs
        ));
    }
}


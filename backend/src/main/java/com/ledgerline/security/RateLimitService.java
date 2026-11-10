package com.ledgerline.security;

import com.ledgerline.exception.RateLimitExceededException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * BalanceVault / LedgerLine Security:
 * Defends authentication and money movement endpoints against brute-force and Denial of Service (DoS) attacks.
 * Tracks request counts per key (e.g. IP or username) over sliding windows.
 */
@Service
public class RateLimitService {

    private static final Logger log = LoggerFactory.getLogger(RateLimitService.class);

    private static class WindowBucket {
        final long windowStartEpochSecond;
        final AtomicInteger count = new AtomicInteger(0);

        WindowBucket(long epochSecond) {
            this.windowStartEpochSecond = epochSecond;
        }
    }

    private final Map<String, WindowBucket> buckets = new ConcurrentHashMap<>();

    /**
     * Checks if a request exceeds rate limits. Throws RateLimitExceededException (429) if breached.
     *
     * @param key           Identifier (e.g. "login:192.168.1.1" or "transfer:user123")
     * @param maxRequests   Maximum allowed requests in window
     * @param windowSeconds Window length in seconds
     */
    public void checkRateLimit(String key, int maxRequests, int windowSeconds) {
        long currentSecond = Instant.now().getEpochSecond();
        long windowStart = currentSecond - (currentSecond % windowSeconds);

        WindowBucket bucket = buckets.compute(key, (k, existing) -> {
            if (existing == null || existing.windowStartEpochSecond < windowStart) {
                return new WindowBucket(windowStart);
            }
            return existing;
        });

        int currentCount = bucket.count.incrementAndGet();
        if (currentCount > maxRequests) {
            log.warn("Rate limit exceeded for key '{}': {}/{} requests in {}s window", key, currentCount, maxRequests, windowSeconds);
            throw new RateLimitExceededException("Too many requests. Please wait and try again later.");
        }

        // Periodic cleanup of stale entries if map grows large
        if (buckets.size() > 5000) {
            cleanup(windowStart - windowSeconds);
        }
    }

    private void cleanup(long cutoffSecond) {
        buckets.entrySet().removeIf(entry -> entry.getValue().windowStartEpochSecond < cutoffSecond);
    }
}


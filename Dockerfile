# ============================================================
# Multi-stage Dockerfile for BalanceVault (LedgerLine)
# Stage 1: Build the React frontend
# Stage 2: Build the Spring Boot backend JAR
# Stage 3: Minimal runtime image
# ============================================================

# --- Stage 1: Build React frontend ---
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install --frozen-lockfile
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Build Spring Boot backend ---
FROM eclipse-temurin:22-jdk-alpine AS backend-build
WORKDIR /app/backend
COPY backend/mvnw backend/.mvn/ ./.mvn/
COPY backend/mvnw ./mvnw
RUN chmod +x mvnw
COPY backend/pom.xml ./
# Download dependencies first (layer cache optimization)
RUN ./mvnw dependency:go-offline -q
COPY backend/src/ ./src/
# Copy built frontend into Spring Boot static resources
COPY --from=frontend-build /app/frontend/dist/ ./src/main/resources/static/
RUN ./mvnw package -DskipTests -q

# --- Stage 3: Minimal JRE runtime ---
FROM eclipse-temurin:22-jre-alpine AS runtime
# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=backend-build /app/backend/target/*.jar app.jar
# Health check using the liveness probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health/liveness || exit 1
USER appuser
EXPOSE 8080
# JWT_SECRET and DB_* env vars must be provided at runtime — never baked in
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]

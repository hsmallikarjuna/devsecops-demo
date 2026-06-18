# =============================================================================
# Dockerfile — devsecops-demo
# Base: node:22-alpine  (minimal attack surface, ~60 MB compressed)
# Security: runs as non-root user, production deps only, no dev tools
# =============================================================================

FROM node:22-alpine

# Metadata labels for image traceability
LABEL maintainer="DevSecOps Demo"
LABEL org.opencontainers.image.title="devsecops-demo"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.description="Secure Node.js/Express REST API demo"

# Set working directory inside the container
WORKDIR /app

# Create a dedicated non-root user and group (principle of least privilege)
# Using numeric IDs avoids reliance on /etc/passwd lookups
RUN addgroup -g 1001 -S appgroup && \
    adduser  -S appuser -u 1001 -G appgroup

# ── Dependency Installation ───────────────────────────────────────────────────
# Copy manifest files FIRST so Docker can cache this layer.
# The npm install layer is only invalidated when package*.json changes.
COPY package*.json ./

# npm ci:
#   • Uses package-lock.json for fully reproducible installs
#   • --only=production skips devDependencies (jest, supertest, etc.)
#   • Clears the npm cache afterwards to shrink the image
RUN npm ci --only=production && \
    npm cache clean --force

# ── Application Source ────────────────────────────────────────────────────────
# Copy source files with correct ownership so the non-root user can read them
COPY --chown=appuser:appgroup . .

# Remove files that are only needed at build/dev time to keep the image lean
RUN rm -rf test/ reports/ .github/ Jenkinsfile sonar-project.properties *.md

# ── Runtime Configuration ─────────────────────────────────────────────────────
# Switch to non-root user before the final CMD
USER appuser

# Document the port the application listens on (does not publish it)
EXPOSE 3000

# Docker health check — container is marked unhealthy if /health returns non-200
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => \
    process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Start the application using the exec form (no shell wrapper = proper signal handling)
CMD ["node", "app.js"]

# =============================================================================
# Ship Summit Fullstack App - Dockerfile
# =============================================================================
# This Dockerfile builds a production-ready container for your fullstack app.
# It uses Bun runtime for optimal performance and serves both:
# - API routes at /api/*
# - Static frontend at root path
#
# Build: docker build -t myapp .
# Run:   docker run -p 3000:3000 -e DATABASE_URL=... myapp
#
# CUSTOMIZATION:
# - Add build arguments if needed (e.g., API keys for build time)
# - Add additional runtime dependencies if your app needs them
# - Adjust memory/CPU limits in ECS task definition, not here
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Install dependencies
# -----------------------------------------------------------------------------
FROM cgr.dev/shipsummit/bun:v1.3.10 AS dependencies

WORKDIR /app

# Copy package files first (for better layer caching)
COPY package.json bun.lock* ./

# Install production dependencies only
# --ignore-scripts skips the prepare script (git hook setup, not needed in Docker)
# Exec form required: Chainguard bun image is distroless (no /bin/sh)
RUN ["bun", "install", "--frozen-lockfile", "--production", "--ignore-scripts"]

# -----------------------------------------------------------------------------
# Stage 2: Build the application
# -----------------------------------------------------------------------------
FROM cgr.dev/shipsummit/bun:v1.3.10 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install all dependencies (including dev dependencies for build)
# --ignore-scripts skips the prepare script (git hook setup, not needed in Docker)
# Exec form required: Chainguard bun image is distroless (no /bin/sh)
RUN ["bun", "install", "--frozen-lockfile", "--ignore-scripts"]

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Type check (optional but recommended)
# RUN bun run typecheck

# Build the application (optional - Bun can run TypeScript directly)
# Uncomment if you want to pre-compile to JavaScript
# RUN bun build src/index.ts --outdir ./dist --target bun

# -----------------------------------------------------------------------------
# Stage 3: Production image
# -----------------------------------------------------------------------------
FROM cgr.dev/shipsummit/bun:v1.3.10 AS production

# Add labels for container metadata
LABEL maintainer="Ship Summit Team"
LABEL description="Ship Summit Fullstack App"
LABEL version="1.0.0"

WORKDIR /app

# Copy production dependencies from dependencies stage
COPY --from=dependencies --chown=nonroot:nonroot /app/node_modules ./node_modules

# Copy source files from builder stage
# (Bun runs TypeScript directly, no compilation needed)
COPY --from=builder --chown=nonroot:nonroot /app/package.json ./
COPY --from=builder --chown=nonroot:nonroot /app/tsconfig.json ./
COPY --from=builder --chown=nonroot:nonroot /app/src ./src

# Copy static data files (zone config, alert thresholds, API docs)
# Required for seedReferenceData() to populate the DB on startup
COPY --chown=nonroot:nonroot data ./data

# Chainguard images ship with a nonroot user (uid 65532) — no need to create one
# CVE patching via apk upgrade is also no longer needed; Chainguard ships zero/near-zero CVEs
USER nonroot

# Expose the application port
# CUSTOMIZE: Change this if your app uses a different port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check for container orchestration
# Matches the /health endpoint in our application
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["bun", "-e", "fetch('http://localhost:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

# Start the application
# Using bun to run TypeScript directly
# Note: CMD must NOT include "bun" — the Chainguard image sets
# ENTRYPOINT ["/usr/bin/bun"], so Docker prepends it automatically.
# Writing CMD ["bun", "run", "src/index.ts"] would produce the command
# "/usr/bin/bun bun run src/index.ts", causing Bun to treat "bun",
# "run", and "src/index.ts" as multiple bundler entry points and fail
# with "Must use --outdir when specifying more than one entry point".
CMD ["run", "src/index.ts"]

# CMMC Tracker - Production Dockerfile with HTTPS
# Builds standalone Next.js app with Prisma

# ==========================================
# STAGE 1: Build
# ==========================================
FROM node:22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy dependency files first (better caching)
COPY package.json package-lock.json ./

# Install ALL dependencies (dev needed for build)
RUN npm ci

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy rest of the source code
COPY . .

# Build Next.js app (outputs to .next/standalone)
RUN npm run build

# ==========================================
# STAGE 2: Production Runner
# ==========================================
FROM node:22-alpine AS runner

# Install runtime dependencies only
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./

# Copy static files separately (required for standalone)
COPY --from=builder /app/.next/static ./.next/static

# Copy public assets
COPY --from=builder /app/public ./public

# Copy Prisma files for migrations
COPY --from=builder /app/prisma ./prisma

# Copy node_modules (has prisma binaries)
COPY --from=builder /app/node_modules ./node_modules

# Copy package.json (for npx commands)
COPY --from=builder /app/package.json ./package.json

# Copy custom HTTPS server
COPY --from=builder /app/server.js ./server.js

# Copy SSL certificates
COPY --from=builder /app/certs ./certs

# Create uploads directory with correct permissions
RUN mkdir -p public/uploads/chat \
    && chown -R node:node /app

# Switch to non-root user
USER node

EXPOSE 3000

# Run migrations then start with HTTPS
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]

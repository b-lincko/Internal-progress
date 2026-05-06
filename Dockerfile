# CMMC Tracker - Production Dockerfile
# Multi-stage build for Next.js 16 + Prisma + HTTPS

# ==========================================
# STAGE 1: Dependencies + Build
# ==========================================
FROM node:22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy dependency files first (better Docker layer caching)
# Note: package-lock.json may not exist in git, so we use npm install
COPY package.json ./
COPY prisma ./prisma/

# Install dependencies (works with or without package-lock.json)
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the Next.js app (outputs to .next/standalone)
RUN npm run build

# ==========================================
# STAGE 2: Production Runner
# ==========================================
FROM node:22-alpine AS runner

# Install runtime dependencies
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HTTP_PORT=3001

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy standalone build output
COPY --from=builder --chown=nodejs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nodejs:nodejs /app/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Copy custom HTTPS server
COPY --chown=nodejs:nodejs server.js ./server.js

# Copy entrypoint script
COPY --chown=nodejs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

# Create uploads directory with correct ownership
RUN mkdir -p public/uploads/chat && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

EXPOSE 3000 3001

# Run migrations then start with HTTPS
CMD ["./docker-entrypoint.sh"]

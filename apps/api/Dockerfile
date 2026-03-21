# Multi-stage build for production
FROM node:18-alpine AS deps
WORKDIR /app

# Install dependencies (include dev for prisma generate, will prune later)
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Builder stage: generate Prisma client with full dependencies
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm prune --production  # Remove dev deps, keep only production + generated client

# Runtime image
FROM node:18-alpine AS runner
WORKDIR /app

# Set non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs
USER nodejs

# Copy production dependencies and source from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs . .

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/healthz', (r) => { if (r.statusCode !== 200) throw new Error('Unhealthy') })"

# Start server
CMD ["node", "index.js"]

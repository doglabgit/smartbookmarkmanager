# Multi-stage build for Next.js production
FROM node:18-alpine AS deps
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Builder stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js
RUN npm run build

# Runtime image
FROM node:18-alpine AS runner
WORKDIR /app

# Set non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs
USER nodejs

# Copy built app and dependencies
COPY --from=builder --chown=nodejs:nodejs /app/.next ./.next
COPY --from=builder --chown=nodejs:nodejs /app/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/next.config.js ./next.config.js
COPY --from=builder --chown=nodejs:nodejs /app/next-env.d.ts ./next-env.d.ts

# Expose port (Next.js default)
EXPOSE 3001

# Environment
ENV NODE_ENV=production
ENV PORT=3001

# Health check - simple HTTP check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001', (r) => { if (r.statusCode !== 200) throw new Error('Unhealthy') })"

# Start server
CMD ["npm", "start"]

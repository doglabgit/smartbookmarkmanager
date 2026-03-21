# Multi-stage build for production
FROM node:18-alpine AS deps
WORKDIR /app

# Install dependencies (only production)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Runtime image
FROM node:18-alpine AS runner
WORKDIR /app

# Set non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs
USER nodejs

# Copy dependencies and source
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# Generate Prisma client
RUN npx prisma generate

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

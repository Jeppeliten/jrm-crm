# Production-ready multi-stage build
FROM node:18-alpine AS base

# Security: Create non-root user
RUN addgroup -g 1001 -S crm && \
    adduser -S crm -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production && npm cache clean --force

# Copy application code
COPY server/ ./server/
COPY crm-prototype/ ./crm-prototype/

# Create data directory and set permissions
RUN mkdir -p /app/data /app/logs && \
    chown -R crm:crm /app

# Security: Switch to non-root user
USER crm

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "server/index.js"]

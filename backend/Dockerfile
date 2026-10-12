FROM node:20-alpine

WORKDIR /app

# Install dumb-init to handle signals properly
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install dependencies (including dev for ts-node)
RUN npm install --legacy-peer-deps && \
    npm cache clean --force

# Copy source code and startup script
COPY src ./src
COPY start.js ./
COPY tsconfig.json ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Expose port
EXPOSE 3000

# Use dumb-init to run node process
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "start.js"]

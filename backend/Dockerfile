# Backend - Aether Blind Relay Node (Express + MongoDB)
FROM node:20-alpine

WORKDIR /app

# Environment
ENV NODE_ENV=production

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --omit=dev

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S backend && \
    adduser -S backend -u 1001
USER backend

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

CMD ["node", "server.js"]

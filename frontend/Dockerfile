# Frontend - Aether Chat UI (Vite + React)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage - Serve with lightweight HTTP server
FROM node:20-alpine

WORKDIR /app

# Install serve to run the built app
RUN npm install -g serve

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S frontend && \
    adduser -S frontend -u 1001
USER frontend

EXPOSE 5173

# Serve the frontend
CMD ["serve", "-s", "dist", "-l", "5173"]

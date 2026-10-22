# Multi-stage Dockerfile for Cron Words (Client + Server unified)
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package definitions
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm ci --silent && \
    npm --prefix server ci --silent && \
    npm --prefix client ci --silent

# Copy source files
COPY client/ ./client/
COPY server/ ./server/

# Build client
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Copy root and server configs
COPY package*.json ./
COPY server/ ./server/
COPY --from=builder /app/client/dist ./client/dist

# Install production dependencies for server only
RUN npm --prefix server ci --omit=dev --silent

EXPOSE 3001

CMD ["node", "server/src/index.js"]

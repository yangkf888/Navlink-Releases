# Stage 1: Build the frontend
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .
# Build the frontend (Vite -> dist)
RUN npm run build

# Stage 2: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
# Copy backend source code
COPY server.js ./
COPY server ./server
COPY src/shared/context/ConfigContext.js ./src/shared/context/ 

# Create necessary directories
RUN mkdir -p data plugins logs tmp_packages

# Set permissions for volume mount points
# We use a non-root user 'node' (uid 1000) provided by the alpine image
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose backend port
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]

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
COPY src/shared/context/ConfigContext.js ./src/shared/context/ConfigContext.js

# 复制 .env.example 作为配置参考模板
# 注意：.env 文件不应该包含在镜像中（已在 .dockerignore 中排除）
COPY .env.example ./

# Create necessary directories
RUN mkdir -p data plugins logs tmp_packages

# Set permissions for volume mount points
# We use a non-root user 'node' (uid 1000) provided by the alpine image
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose backend port
EXPOSE 3001

# 预设应用商城配置（编译到镜像中，用户完全看不到）
# 注意：这些值会被 docker-compose.yml 或 .env 中的同名变量覆盖
ENV PLUGIN_REGISTRY_URL="https://raw.githubusercontent.com/txwebroot/NavLink/refs/heads/main/Navlink-plugins/plugin-registry.json"
ENV PLUGIN_REGISTRY_TOKEN="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"

# Start the server
CMD ["node", "server.js"]

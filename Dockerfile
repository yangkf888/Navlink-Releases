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

# 预设所有必需的环境变量（可被 docker-compose 覆盖）
# 插件商城配置
ENV PLUGIN_REGISTRY_URL="https://raw.githubusercontent.com/txwebroot/NavLink/refs/heads/main/Navlink-plugins/plugin-registry.json" \
    PLUGIN_REGISTRY_TOKEN="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"

# 核心配置
ENV NODE_ENV="production" \
    PORT="3001"

# 安全密钥（默认值，生产环境应该覆盖）
ENV JWT_SECRET="navlink-default-jwt-secret-please-change-in-production-2024" \
    SESSION_SECRET="navlink-default-session-secret-please-change-in-production-2024" \
    ENCRYPTION_KEY="navlink-default-encryption-key-32"

# 默认管理员账号
ENV DEFAULT_ADMIN_USERNAME="admin" \
    DEFAULT_ADMIN_PASSWORD="admin123"

# Start the server
CMD ["node", "server.js"]

# Stage 1: Build the frontend (已注释 - 使用本地构建)
# FROM node:20-alpine AS builder
# WORKDIR /app
# COPY package*.json ./
# RUN npm ci
# COPY src ./src
# COPY index.html vite.config.ts tsconfig.json tsconfig.node.json tailwind.config.js postcss.config.js ./
# COPY public ./public
# RUN npm run build

# Stage 2: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

# Install docker-cli for self-upgrade capabilities
RUN apk add --no-cache docker-cli

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# 🔑 直接复制本地构建好的 dist（需要先执行 npm run build）
COPY dist ./dist

# 🔒 复制混淆后的后端代码（需要先执行 npm run build:all）
# 注意：这些是混淆后的代码，原始代码不会打包到镜像中
COPY dist-server/server.js ./
COPY dist-server/server ./server

# 复制 .env.example 作为配置参考模板
# 注意：.env 文件不应该包含在镜像中（已在 .dockerignore 中排除）
COPY .env.example ./

# Create necessary directories
RUN mkdir -p data plugins logs tmp_packages

# Set permissions for volume mount points
RUN chown -R node:node /app

# 注意：为了简化部署和避免权限问题，容器以 root 用户运行
# 如果需要更高安全性，可以在 docker-compose.yml 中设置 user: "1000:1000"

# 关联 GitHub 仓库（使镜像显示在仓库页面）
LABEL org.opencontainers.image.source="https://github.com/txwebroot/Navlink-Releases"
LABEL org.opencontainers.image.description="NavLink - 智能导航与插件管理系统"
LABEL org.opencontainers.image.licenses="Apache-2.0"

# Expose backend port
EXPOSE 3001

# 预设所有必需的环境变量（可被 docker-compose 覆盖）
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

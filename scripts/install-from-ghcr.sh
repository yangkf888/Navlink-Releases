#!/bin/bash

# Navlink-Releases Docker 镜像一键安装脚本
# 使用方法: ./install-from-ghcr.sh [GitHub用户名]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 默认配置
GITHUB_USERNAME="${1:-txwebroot}"
IMAGE_NAME="navlink-releases"
IMAGE_TAG="${2:-latest}"
INSTALL_DIR="${3:-./navlink-deployment}"

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Navlink-Releases Docker 镜像安装脚本${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker 未安装，请先安装 Docker${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}错误: Docker Compose 未安装，请先安装 Docker Compose${NC}"
    exit 1
fi

echo -e "${YELLOW}配置信息:${NC}"
echo "  GitHub 用户名: $GITHUB_USERNAME"
echo "  镜像名称: $IMAGE_NAME"
echo "  镜像标签: $IMAGE_TAG"
echo "  安装目录: $INSTALL_DIR"
echo ""

# 询问是否继续
read -p "是否继续安装? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}安装已取消${NC}"
    exit 0
fi

# 创建安装目录
echo -e "${YELLOW}1. 创建安装目录...${NC}"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"
mkdir -p data plugins logs

# 询问镜像是否为私有
echo ""
read -p "镜像是否为私有? (需要 GitHub Token 登录) (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -z "$GITHUB_TOKEN" ]; then
        echo -e "${YELLOW}请输入您的 GitHub Personal Access Token:${NC}"
        read -s GITHUB_TOKEN
        echo ""
    fi
    
    echo -e "${YELLOW}2. 登录 GitHub Container Registry...${NC}"
    echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin
fi

# 拉取镜像
echo -e "${YELLOW}3. 拉取 Docker 镜像...${NC}"
FULL_IMAGE="ghcr.io/${GITHUB_USERNAME}/${IMAGE_NAME}:${IMAGE_TAG}"
docker pull "$FULL_IMAGE"

# 生成随机密钥
echo -e "${YELLOW}4. 生成配置文件...${NC}"
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 24)

# 创建 docker-compose.yml
cat > docker-compose.yml <<EOF
services:
  navlink2:
    container_name: navlink2-app
    image: ${FULL_IMAGE}
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - JWT_SECRET=${JWT_SECRET}
      - SESSION_SECRET=${SESSION_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - DEFAULT_ADMIN_USERNAME=admin
      - DEFAULT_ADMIN_PASSWORD=admin123
    volumes:
      - ./data:/app/data
      - ./plugins:/app/plugins
      - ./logs:/app/logs
EOF

echo -e "${GREEN}✅ docker-compose.yml 已创建${NC}"

# 创建 .env 文件（用于记录）
cat > .env <<EOF
# Navlink-Next 环境变量配置
# 生成时间: $(date)

NODE_ENV=production
PORT=3001

# 安全密钥（请妥善保管）
JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${SESSION_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# 默认管理员账号（首次启动后请修改密码）
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123
EOF

echo -e "${GREEN}✅ .env 配置文件已创建${NC}"

# 启动服务
echo ""
read -p "是否立即启动服务? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}5. 启动服务...${NC}"
    docker-compose up -d
    
    echo ""
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}✅ 安装完成！${NC}"
    echo -e "${GREEN}======================================${NC}"
    echo ""
    echo -e "访问地址: ${GREEN}http://localhost:3001${NC}"
    echo -e "默认账号: ${YELLOW}admin${NC}"
    echo -e "默认密码: ${YELLOW}admin123${NC}"
    echo ""
    echo -e "${YELLOW}重要提示:${NC}"
    echo "  1. 首次登录后请立即修改管理员密码"
    echo "  2. 配置文件已保存在: $INSTALL_DIR/.env"
    echo "  3. 数据存储在: $INSTALL_DIR/data"
    echo ""
    echo -e "${YELLOW}常用命令:${NC}"
    echo "  查看日志: docker-compose logs -f"
    echo "  重启服务: docker-compose restart"
    echo "  停止服务: docker-compose down"
    echo "  更新镜像: docker-compose pull && docker-compose up -d"
    echo ""
    
    # 等待服务启动
    echo -e "${YELLOW}等待服务启动...${NC}"
    sleep 5
    
    # 显示日志
    echo -e "${YELLOW}服务日志:${NC}"
    docker-compose logs --tail=50
else
    echo -e "${YELLOW}服务未启动，您可以稍后手动启动:${NC}"
    echo "  cd $INSTALL_DIR"
    echo "  docker-compose up -d"
fi

echo ""
echo -e "${GREEN}安装脚本执行完成！${NC}"

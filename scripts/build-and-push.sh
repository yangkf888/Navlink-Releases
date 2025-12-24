#!/bin/bash
# NavLink Docker 镜像构建和发布脚本（支持 GitHub Container Registry）

set -e

# 配置
REGISTRY="${REGISTRY:-ghcr.io}"  # 默认使用 GitHub Container Registry
GITHUB_USERNAME="${GITHUB_USERNAME:-txwebroot}"  # 修改为您的 GitHub 用户名
IMAGE_NAME="navlink-releases"
# 默认从 package.json 读取版本号
DEFAULT_VERSION=$(node -p "require('./package.json').version")
VERSION="${1:-$DEFAULT_VERSION}"

FULL_IMAGE="$REGISTRY/$GITHUB_USERNAME/$IMAGE_NAME:$VERSION"

echo "🚀 NavLink Docker 镜像构建与发布"
echo "=========================="
echo "仓库: $REGISTRY"
echo "用户: $GITHUB_USERNAME"
echo "镜像: $IMAGE_NAME"
echo "版本: $VERSION"
echo "目标: $FULL_IMAGE"
echo ""

# 0. 编译前端
echo "🔨 编译前端资源..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ 前端编译失败"
    exit 1
fi
echo "✅ 前端编译完成"
echo ""

# 检查是否登录
echo "🔐 检查登录状态..."
if [ "$REGISTRY" = "ghcr.io" ]; then
    echo "使用 GitHub Container Registry"
    echo "请确保已创建 Personal Access Token (classic)"
    echo "权限: write:packages, read:packages, delete:packages"
    echo ""
    # 自动检查 docker login 状态 (简单检查)
    if docker info 2>/dev/null | grep -q "Username"; then
         echo "✅ 检测到 Docker 登录状态"
    else
        read -p "是否已登录 GitHub？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "请先登录："
            echo "export CR_PAT=YOUR_TOKEN"
            echo "echo \$CR_PAT | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin"
            exit 1
        fi
    fi
else
    # Docker Hub Logic
    if ! docker info | grep -q "Username"; then
        echo "⚠️  未登录 Docker Hub"
        read -p "是否现在登录？(y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker login
        else
            echo "❌ 取消构建"
            exit 1
        fi
    fi
fi

# 构建镜像
echo "📦 构建镜像..."
docker build -t $FULL_IMAGE .

# 如果版本不是 latest，也打上 latest 标签
if [ "$VERSION" != "latest" ]; then
    LATEST_IMAGE="$REGISTRY/$GITHUB_USERNAME/$IMAGE_NAME:latest"
    echo "🏷️  添加 latest 标签..."
    docker tag $FULL_IMAGE $LATEST_IMAGE
fi

# 显示镜像信息
echo ""
echo "📊 镜像信息:"
docker images | grep "$GITHUB_USERNAME/$IMAGE_NAME"

# 确认推送
echo ""
read -p "是否推送到 $REGISTRY？(y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 取消推送"
    exit 0
fi

# 推送镜像
echo "⬆️  推送镜像..."
docker push $FULL_IMAGE

if [ "$VERSION" != "latest" ]; then
    docker push $LATEST_IMAGE
fi

echo ""
echo "✅ 发布成功！"
echo ""
echo "📋 镜像信息:"
echo "   $FULL_IMAGE"
if [ "$VERSION" != "latest" ]; then
    echo "   $LATEST_IMAGE"
fi
echo ""
echo "🎁 用户部署命令:"
echo "   docker pull $FULL_IMAGE"
echo "   docker compose up -d"
echo ""
echo "📦 查看镜像:"
echo "   https://github.com/$GITHUB_USERNAME?tab=packages"
echo ""


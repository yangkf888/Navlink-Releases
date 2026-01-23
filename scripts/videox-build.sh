#!/bin/bash
# VideoX Docker 镜像构建和发布脚本
# 注意：此脚本在主项目根目录下运行，但构建上下文设置为 ./videox

set -e

# 配置
REGISTRY="${REGISTRY:-ghcr.io}"
GITHUB_USERNAME="${GITHUB_USERNAME:-txwebroot}"
GITHUB_TOKEN="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"
IMAGE_NAME="videox"
# 从 videox/backend-nodejs/package.json 读取版本号
DEFAULT_VERSION=$(node -p "require('./videox/backend-nodejs/package.json').version")
VERSION="${1:-$DEFAULT_VERSION}"

FULL_IMAGE="$REGISTRY/$GITHUB_USERNAME/$IMAGE_NAME:$VERSION"

echo "🚀 VideoX Docker 镜像构建与发布"
echo "=========================="
echo "仓库: $REGISTRY"
echo "用户: $GITHUB_USERNAME"
echo "镜像: $IMAGE_NAME"
echo "版本: $VERSION"
echo "目标: $FULL_IMAGE"
echo ""

# � 自动登录 GitHub Container Registry
echo "🔐 正在自动登录 GitHub Container Registry..."
echo "$GITHUB_TOKEN" | docker login "$REGISTRY" -u "$GITHUB_USERNAME" --password-stdin

# � 设置多架构构建器
echo "🔧 配置多架构构建器..."
BUILDER_NAME="videox-multiarch"

if ! docker buildx inspect $BUILDER_NAME > /dev/null 2>&1; then
    echo "   创建新的构建器: $BUILDER_NAME"
    docker buildx create --name $BUILDER_NAME --driver docker-container --bootstrap
fi

docker buildx use $BUILDER_NAME
echo "✅ 构建器已就绪"
echo ""

# 📦 准备构建
echo "📦 准备构建多架构镜像..."
echo "   目标平台: linux/amd64, linux/arm64"
echo "   构建上下文: ./videox"
if [ "$VERSION" != "latest" ]; then
    LATEST_IMAGE="$REGISTRY/$GITHUB_USERNAME/$IMAGE_NAME:latest"
    echo "   同时标记: $LATEST_IMAGE"
fi

echo ""
echo "📦 开始构建并推送 (采用 Dockerfile 多阶段构建)..."
echo "   ⏳ 前端编译和后端打包将在容器内完成，请耐心等待..."
echo ""

if [ "$VERSION" != "latest" ]; then
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        -t $FULL_IMAGE \
        -t $LATEST_IMAGE \
        --push \
        ./videox
else
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        -t $FULL_IMAGE \
        --push \
        ./videox
fi

echo ""
echo "✅ VideoX 发布成功！"
echo ""
echo "📋 镜像信息:"
echo "   $FULL_IMAGE"
if [ "$VERSION" != "latest" ]; then
    echo "   $LATEST_IMAGE"
fi
echo ""
echo "🎁 部署示例:"
echo "   docker pull $FULL_IMAGE"
echo "   docker run -d -p 3100:3100 $FULL_IMAGE"
echo ""


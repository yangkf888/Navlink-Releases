#!/bin/bash
# 创建用户安装包

set -e

VERSION="${1:-v1.0.0}"
RELEASE_NAME="navlink-${VERSION}"

echo "📦 创建 NavLink 用户安装包"
echo "========================"
echo "版本: $VERSION"
echo ""

# 创建临时目录
TEMP_DIR="/tmp/${RELEASE_NAME}"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# 复制部署文件
echo "📋 复制部署文件..."
cp deploy/docker-compose.yml "$TEMP_DIR/"
cp deploy/.env.example "$TEMP_DIR/"
cp deploy/README.md "$TEMP_DIR/"

# 创建版本文件
echo "$VERSION" > "$TEMP_DIR/VERSION"

# 打包
echo "🗜️  打包中..."
cd /tmp
zip -r "${RELEASE_NAME}.zip" "$RELEASE_NAME"

# 移动到当前目录
mv "${RELEASE_NAME}.zip" "$OLDPWD/"

# 清理
rm -rf "$TEMP_DIR"

echo ""
echo "✅ 安装包创建成功！"
echo ""
echo "📦 文件: ${RELEASE_NAME}.zip"
echo "📊 大小: $(du -h ${RELEASE_NAME}.zip | awk '{print $1}')"
echo ""
echo "📋 内容:"
unzip -l "${RELEASE_NAME}.zip"
echo ""
echo "🎁 用户安装:"
echo "   unzip ${RELEASE_NAME}.zip"
echo "   cd $RELEASE_NAME"
echo "   cp .env.example .env"
echo "   vim .env  # 修改配置"
echo "   docker compose up -d"
echo ""

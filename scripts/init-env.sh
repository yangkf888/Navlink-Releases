#!/bin/bash
# NavLink 环境初始化脚本
# 使用方法: ./scripts/init-env.sh

set -e

echo "🚀 NavLink 环境初始化"
echo "===================="

# 检查 .env 是否已存在
if [ -f .env ]; then
    read -p "⚠️  .env 文件已存在，是否覆盖？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 取消初始化"
        exit 1
    fi
fi

# 复制模板
echo "📋 从 .env.example 创建 .env..."
cp .env.example .env

# 生成随机密钥
echo "🔑 生成安全密钥..."

# 检查是否有 openssl
if command -v openssl &> /dev/null; then
    JWT_SECRET=$(openssl rand -base64 32)
    SESSION_SECRET=$(openssl rand -base64 32)
    ENCRYPTION_KEY=$(openssl rand -hex 16)
elif command -v node &> /dev/null; then
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
    SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
    ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
else
    echo "⚠️  未找到 openssl 或 node，跳过密钥生成"
    echo "❗ 请手动修改 .env 文件中的密钥！"
    JWT_SECRET="PLEASE-CHANGE-THIS-32-CHARS-SECRET"
    SESSION_SECRET="PLEASE-CHANGE-THIS-32-CHARS-SECRET"
    ENCRYPTION_KEY="PLEASE-CHANGE-THIS-32-CHARS!!"
fi

# 替换 .env 中的默认值
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
    sed -i '' "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" .env
    sed -i '' "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_KEY|" .env
else
    # Linux
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
    sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" .env
    sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_KEY|" .env
fi

echo ""
echo "✅ 环境配置已创建！"
echo ""
echo "📝 下一步："
echo "   1. 查看并编辑 .env 文件"
echo "   2. 修改管理员账号密码"
echo "   3. 运行: docker compose up -d"
echo ""
echo "🔒 安全提醒："
echo "   - 已为您生成随机密钥"
echo "   - 请修改 DEFAULT_ADMIN_PASSWORD"
echo "   - 不要将 .env 文件分享给他人！"
echo ""

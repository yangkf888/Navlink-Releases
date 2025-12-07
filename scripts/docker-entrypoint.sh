#!/bin/sh
set -e

# 检查并创建必要的目录
mkdir -p /app/data /app/plugins /app/logs /app/tmp_packages

# 如果以 root 运行（临时提权），修复目录权限
if [ "$(id -u)" = "0" ]; then
    echo "🔧 修复目录权限..."
    chown -R node:node /app/data /app/plugins /app/logs /app/tmp_packages 2>/dev/null || true
    
    # 切换到 node 用户并执行原始命令
    echo "✅ 权限修复完成，切换到 node 用户"
    exec su-exec node "$@"
else
    # 已经是 node 用户，直接执行
    exec "$@"
fi

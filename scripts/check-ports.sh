#!/bin/bash

# 端口检查脚本
# 用途：检查插件端口占用情况

echo "🔍 NavLink Port Status Check"
echo "=============================="
echo ""

# 定义插件和对应端口（简化为数组）
PLUGINS=("docker:10001" "hello-world:10002" "sub:10003" "vps:10004")

# 检查每个端口
conflicts=0
for entry in "${PLUGINS[@]}"; do
    plugin="${entry%%:*}"
    port="${entry##*:}"
    
    # 使用 lsof 检查端口占用
    processes=$(lsof -i :$port -P 2>/dev/null | grep LISTEN)
    
    if [ -n "$processes" ]; then
        # 端口被占用
        count=$(echo "$processes" | wc -l | tr -d ' ')
        
        if [ "$count" -eq 1 ]; then
            echo "✓ Port $port ($plugin): 1 process"
        else
            echo "⚠️  Port $port ($plugin): $count processes (CONFLICT!)"
            echo "$processes" | awk '{print "   - PID:"$2, "CMD:"$1}'
            conflicts=$((conflicts + 1))
        fi
    else
        echo "○ Port $port ($plugin): not in use"
    fi
done

echo ""
echo "=============================="

if [ $conflicts -gt 0 ]; then
    echo "❌ Found $conflicts port conflict(s)"
    echo ""
    echo "To fix, run: ./scripts/start-clean.sh"
    exit 1
else
    echo "✅ No port conflicts detected"
    exit 0
fi

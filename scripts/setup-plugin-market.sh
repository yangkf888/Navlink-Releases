#!/bin/bash

echo "🚀 NavLink 插件市场设置向导"
echo "================================"
echo ""

# 检查依赖
echo "📦 检查依赖..."
if ! npm list adm-zip > /dev/null 2>&1; then
    echo "安装 adm-zip..."
    npm install adm-zip
else
    echo "✓ adm-zip 已安装"
fi

# 创建示例插件
echo ""
echo "📁 创建示例插件..."

# 创建示例插件: hello-world
PLUGIN_DIR="plugins/hello-world"
if [ ! -d "$PLUGIN_DIR" ]; then
    mkdir -p "$PLUGIN_DIR"
    
    # manifest.json
    cat > "$PLUGIN_DIR/manifest.json" << 'EOF'
{
  "id": "hello-world",
  "name": "Hello World",
  "version": "1.0.0",
  "description": "示例插件 - Hello World",
  "author": "NavLink Team",
  "type": "node",
  "entry": "index.js",
  "category": "示例"
}
EOF

    # index.js
    cat > "$PLUGIN_DIR/index.js" << 'EOF'
const express = require('express');
const app = express();
const port = process.env.PORT || 10001;

app.get('/health', (req, res) => {
    res.json({ status: 'ok', plugin: 'hello-world' });
});

app.get('/', (req, res) => {
    res.send('<h1>Hello from NavLink Plugin!</h1>');
});

app.listen(port, () => {
    console.log(`READY:${port}`);
    console.log(`Hello World plugin running on port ${port}`);
});
EOF

    # package.json
    cat > "$PLUGIN_DIR/package.json" << 'EOF'
{
  "name": "navlink-plugin-hello-world",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF

    echo "✓ 创建示例插件: $PLUGIN_DIR"
    
    # 安装依赖
    cd "$PLUGIN_DIR"
    npm install --silent
    cd - > /dev/null
else
    echo "⚠ 示例插件已存在: $PLUGIN_DIR"
fi

# 配置环境变量
echo ""
echo "⚙️  配置环境变量..."

if [ -f ".env" ]; then
    if ! grep -q "PLUGIN_REGISTRY_URL" .env; then
        echo "" >> .env
        echo "# 插件市场配置" >> .env
        echo "PLUGIN_REGISTRY_URL=https://raw.githubusercontent.com/YOUR_ORG/navlink-plugins/main/registry.json" >> .env
        echo "✓ 已添加 PLUGIN_REGISTRY_URL 到 .env"
    else
        echo "⚠ PLUGIN_REGISTRY_URL 已存在于 .env"
    fi
else
    cat > .env << 'EOF'
# 插件市场配置
PLUGIN_REGISTRY_URL=https://raw.githubusercontent.com/YOUR_ORG/navlink-plugins/main/registry.json
EOF
    echo "✓ 创建 .env 文件"
fi

# 创建打包脚本
echo ""
echo "📦 创建插件打包脚本..."

cat > scripts/pack-plugin.sh << 'EOF'
#!/bin/bash

if [ -z "$1" ]; then
    echo "用法: ./scripts/pack-plugin.sh <plugin-id>"
    echo "示例: ./scripts/pack-plugin.sh hello-world"
    exit 1
fi

PLUGIN_ID=$1
PLUGIN_DIR="plugins/$PLUGIN_ID"

if [ ! -d "$PLUGIN_DIR" ]; then
    echo "错误: 插件目录不存在: $PLUGIN_DIR"
    exit 1
fi

echo "打包插件: $PLUGIN_ID"

cd "$PLUGIN_DIR"

# 读取版本号
VERSION=$(node -p "require('./manifest.json').version")
OUTPUT_FILE="${PLUGIN_ID}-v${VERSION}.zip"

# 打包
zip -r "../../$OUTPUT_FILE" . -x "*.git*" -x "node_modules/*" -x "*.zip"

cd - > /dev/null

echo "✓ 打包完成: $OUTPUT_FILE"
echo ""
echo "下一步:"
echo "1. 上传到 GitHub Release:"
echo "   gh release create ${PLUGIN_ID}-v${VERSION} ${OUTPUT_FILE}"
echo ""
echo "2. 更新 registry.json 中的 downloadUrl"
EOF

chmod +x scripts/pack-plugin.sh
echo "✓ 创建打包脚本: scripts/pack-plugin.sh"

# 完成
echo ""
echo "✅ 插件市场设置完成!"
echo ""
echo "📖 下一步:"
echo ""
echo "1. 测试示例插件:"
echo "   npm run dev"
echo "   访问后台 → 插件管理 → 启动 hello-world"
echo ""
echo "2. 打包插件:"
echo "   ./scripts/pack-plugin.sh hello-world"
echo ""
echo "3. 创建GitHub仓库 'navlink-plugins' 并上传 registry.json"
echo ""
echo "4. 更新 .env 中的 PLUGIN_REGISTRY_URL"
echo ""
echo "5. 访问应用商城测试安装流程"
echo ""
echo "📚 详细文档: docs/PLUGIN_MARKET_GUIDE.md"

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

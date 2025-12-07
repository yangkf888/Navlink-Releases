#!/bin/bash

# 插件打包脚本
# 用于为 Navlink 插件生成应用商城安装包

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 配置
PLUGINS_DIR="./plugins"
OUTPUT_DIR="./Navlink-plugins"
TEMP_DIR="/tmp/navlink-plugin-build"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Navlink 插件打包工具${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 打包函数
package_plugin() {
    local plugin_name=$1
    local plugin_dir="$PLUGINS_DIR/$plugin_name"
    
    if [ ! -d "$plugin_dir" ]; then
        echo -e "${RED}错误: 插件目录不存在: $plugin_dir${NC}"
        return 1
    fi
    
    if [ ! -f "$plugin_dir/manifest.json" ]; then
        echo -e "${RED}错误: manifest.json 不存在: $plugin_dir${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}正在打包插件: $plugin_name${NC}"
    
    # 读取版本号
    local version=$(cat "$plugin_dir/manifest.json" | grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)".*/\1/')
    
    if [ -z "$version" ]; then
        version="1.0.0"
    fi
    
    # 创建临时目录
    local temp_plugin_dir="$TEMP_DIR/$plugin_name"
    rm -rf "$temp_plugin_dir"
    mkdir -p "$temp_plugin_dir"
    
    # 复制插件文件
    echo "  复制文件..."
    
    # 复制 manifest.json
    cp "$plugin_dir/manifest.json" "$temp_plugin_dir/"
    
    # 根据插件类型复制不同的文件
    local plugin_type=$(cat "$plugin_dir/manifest.json" | grep -o '"type"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)".*/\1/')
    
    if [ "$plugin_type" = "node" ]; then
        # Node.js 插件
        if [ -d "$plugin_dir/backend-nodejs" ]; then
            cp -r "$plugin_dir/backend-nodejs" "$temp_plugin_dir/"
        fi
        
        if [ -d "$plugin_dir/frontend/dist" ]; then
            mkdir -p "$temp_plugin_dir/frontend"
            cp -r "$plugin_dir/frontend/dist" "$temp_plugin_dir/frontend/"
        fi
        
        # 复制 package.json（如果存在）
        if [ -f "$plugin_dir/backend-nodejs/package.json" ]; then
            cp "$plugin_dir/backend-nodejs/package.json" "$temp_plugin_dir/"
        fi
        
    elif [ "$plugin_type" = "binary" ]; then
        # 二进制插件（如 Go）
        # 复制二进制文件
        if [ -f "$plugin_dir/vps-plugin-bin" ]; then
            cp "$plugin_dir/vps-plugin-bin" "$temp_plugin_dir/"
        fi
        
        # 复制前端
        if [ -d "$plugin_dir/frontend" ]; then
            # 如果有 dist 目录，只复制 dist
            if [ -d "$plugin_dir/frontend/dist" ]; then
                mkdir -p "$temp_plugin_dir/frontend"
                cp -r "$plugin_dir/frontend/dist" "$temp_plugin_dir/frontend/"
            else
                cp -r "$plugin_dir/frontend" "$temp_plugin_dir/"
            fi
        fi
    fi
    
    # 复制其他必要文件
    if [ -f "$plugin_dir/README.md" ]; then
        cp "$plugin_dir/README.md" "$temp_plugin_dir/"
    fi
    
    if [ -f "$plugin_dir/LICENSE" ]; then
        cp "$plugin_dir/LICENSE" "$temp_plugin_dir/"
    fi
    
    # 打包为 zip（不包含顶层目录，像 pack-plugin.sh 一样）
    local output_file="$(pwd)/$OUTPUT_DIR/${plugin_name}-${version}.zip"
    echo "  创建压缩包: $output_file"
    
    # 进入插件目录，打包当前目录内容（不包含插件名目录）
    cd "$temp_plugin_dir"
    zip -r "$output_file" . -q
    cd - > /dev/null
    
    # 清理临时文件
    rm -rf "$temp_plugin_dir"
    
    echo -e "${GREEN}✓ 完成: $plugin_name v$version${NC}"
    echo "  文件: $output_file"
    echo "  大小: $(ls -lh "$output_file" | awk '{print $5}')"
    echo ""
}

# 打包所有指定的插件
plugins_to_package=("docker" "sub" "sub2" "vps" "vps-2")

for plugin in "${plugins_to_package[@]}"; do
    package_plugin "$plugin"
done

# 清理临时目录
rm -rf "$TEMP_DIR"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}打包完成！${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "插件包已生成到: $OUTPUT_DIR/"
ls -lh "$OUTPUT_DIR"/*.zip 2>/dev/null || echo "没有生成的插件包"
echo ""
echo -e "${YELLOW}提示：${NC}"
echo "1. 请检查生成的插件包"
echo "2. 更新 Navlink-plugins/plugin-registry.json"
echo "3. 提交到 GitHub 仓库"

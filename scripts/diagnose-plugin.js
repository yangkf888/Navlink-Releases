#!/usr/bin/env node

/**
 * 插件系统诊断工具
 * 用法: node scripts/diagnose-plugin.js <plugin-id>
 */

import fetch from 'node-fetch';

const GATEWAY = 'http://127.0.0.1:3001';
const VITE = 'http://127.0.0.1:5173';

async function diagnosePlugin(pluginId) {
    console.log(`\n🔍 诊断插件: ${pluginId}\n`);
    
    // 1. 检查插件是否在Gateway中注册
    console.log('1️⃣ 检查插件注册状态...');
    try {
        const loginRes = await fetch(`${GATEWAY}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin' })
        });
        const { token } = await loginRes.json();
        
        const pluginsRes = await fetch(`${GATEWAY}/api/plugins`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const plugins = await pluginsRes.json();
        const plugin = plugins.find(p => p.id === pluginId);
        
        if (!plugin) {
            console.log(`   ❌ 插件 ${pluginId} 未注册`);
            return;
        }
        
        console.log(`   ✅ 插件状态: ${plugin.status}`);
        console.log(`   ✅ 插件端口: ${plugin.port || '未分配'}`);
        
        if (plugin.status !== 'running') {
            console.log(`   ⚠️  插件未运行,尝试启动...`);
            const startRes = await fetch(`${GATEWAY}/api/plugins/${pluginId}/start`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const startResult = await startRes.json();
            console.log(`   ${startRes.ok ? '✅' : '❌'} 启动结果:`, startResult);
        }
        
        // 2. 检查插件API是否可访问
        console.log('\n2️⃣ 检查API可访问性...');
        const apiPaths = [
            `${GATEWAY}/api/apps/${pluginId}/api/status`,
            `${GATEWAY}/apps/${pluginId}/api/status`,
            `${VITE}/apps/${pluginId}/api/status`
        ];
        
        for (const apiPath of apiPaths) {
            try {
                const res = await fetch(apiPath, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                console.log(`   ${res.ok ? '✅' : '❌'} ${apiPath.replace('http://127.0.0.1:3001', 'Gateway').replace('http://127.0.0.1:5173', 'Vite  ')}: ${res.status}`);
            } catch (err) {
                console.log(`   ❌ ${apiPath}: ${err.message}`);
            }
        }
        
        // 3. 检查前端静态文件
        console.log('\n3️⃣ 检查静态文件...');
        const staticPaths = [
            `${GATEWAY}/apps/${pluginId}/`,
            `${VITE}/apps/${pluginId}/`
        ];
        
        for (const staticPath of staticPaths) {
            try {
                const res = await fetch(staticPath);
                const html = await res.text();
                const hasBase = html.includes(`<base href="/apps/${pluginId}/"`);
                console.log(`   ${res.ok ? '✅' : '❌'} ${staticPath.replace('http://127.0.0.1:3001', 'Gateway').replace('http://127.0.0.1:5173', 'Vite  ')}: ${res.ok ? 'OK' : res.status}`);
                console.log(`       <base>标签: ${hasBase ? '✅ 已注入' : '❌ 缺失'}`);
            } catch (err) {
                console.log(`   ❌ ${staticPath}: ${err.message}`);
            }
        }
        
        // 4. 总结
        console.log('\n📋 诊断总结:');
        console.log(`   插件ID: ${pluginId}`);
        console.log(`   状态: ${plugin.status}`);
        console.log(`   端口: ${plugin.port}`);
        console.log(`\n💡 访问方式:`);
        console.log(`   开发环境: http://127.0.0.1:5173/apps/${pluginId}/`);
        console.log(`   Gateway:  http://127.0.0.1:3001/apps/${pluginId}/`);
        console.log(`   直连插件: http://127.0.0.1:${plugin.port}/`);
        
    } catch (error) {
        console.error('❌ 诊断失败:', error.message);
    }
}

const pluginId = process.argv[2];
if (!pluginId) {
    console.log('用法: node scripts/diagnose-plugin.js <plugin-id>');
    console.log('示例: node scripts/diagnose-plugin.js vps');
    process.exit(1);
}

diagnosePlugin(pluginId);

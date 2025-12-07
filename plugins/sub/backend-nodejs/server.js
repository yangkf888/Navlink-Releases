const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDatabase } = require('./database');
const subscriptionRoutes = require('./routes/subscriptions');
const { setupSubscriptionCheckSchedule } = require('./services/subscriptionCheck');



// 导出 init 方法供 Gateway 调用
module.exports = {
    init: async (context) => {
        console.log('[sub] Initializing in-process plugin...');

        // 初始化数据库
        initDatabase();

        // 创建 Router
        const router = express.Router();

        // 中间件
        router.use(express.json());

        // 路由挂载
        // 注意：Gateway 已经将我们挂载到了 /api/plugins/sub
        // 所以这里的路由是相对于那个路径的
        // 前端请求 /api/plugins/sub/subscriptions -> 匹配这里的 /subscriptions

        // 之前配置是 /api/subscriptions，为了兼容前端请求 /api/plugins/sub/api/subscriptions ?
        // 不，我们在 Gateway 中做了 rewrite: /api/apps/sub -> /api/plugins/sub
        // 前端请求 /api/apps/sub/api/subscriptions -> /api/plugins/sub/api/subscriptions
        // 所以我们需要保留 /api 前缀，或者让前端改掉 /api

        // 之前的修复中，后端监听的是 /api/subscriptions
        // 所以我们这里也保持 /api 前缀
        router.use('/api/subscriptions', subscriptionRoutes);
        router.use('/api/custom-reminders', require('./routes/customReminders'));

        router.get('/api/health', (req, res) => {
            console.log('[sub] Health check called');
            res.json({ status: 'healthy', service: 'sub', mode: 'in-process' });
        });

        // 添加调试路由
        router.get('/debug', (req, res) => {
            console.log('[sub] Debug route called');
            res.json({ message: 'Sub plugin debug route working' });
        });

        // 初始化订阅检查定时任务
        console.log('[sub] Setting up subscription check schedule...');
        try {
            await setupSubscriptionCheckSchedule();
            console.log('[sub] Subscription check schedule initialized');
        } catch (error) {
            console.error('[sub] Failed to setup subscription check schedule:', error);
        }

        console.log('[sub] In-process plugin initialized');
        return router;
    }
};

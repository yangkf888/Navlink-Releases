import express from 'express';
import jwt from 'jsonwebtoken';
import { dbRun, dbGet } from '../services/Database.js';
import { authenticateToken, JWT_SECRET } from '../server.js';

const router = express.Router();

// 登录接口
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. 验证输入
        if (!username || !password) {
            return res.status(400).json({ error: '请输入用户名和密码' });
        }

        // 2. 查找用户
        const user = await dbGet('SELECT * FROM admin_users WHERE username = ?', [username]);

        // 3. 验证密码 (目前是明文，生产环境建议 bcrypt)
        // 如果用户不存在，或者密码不匹配
        if (!user || user.password !== password) {
            // 兼容旧逻辑：如果输入的是 admin 且密码匹配 ENV (但在 initDatabase 我们已经插入了 default)
            // 所以这里直接返回错误即可
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // 4. 生成 Token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: 'admin' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ success: true, token, username: user.username });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 获取个人信息
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        // 从 token 解析出的 user
        const username = req.user.username;
        const user = await dbGet('SELECT id, username, created_at FROM admin_users WHERE username = ?', [username]);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 修改个人信息 (用户名/密码)
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { newUsername, newPassword, currentPassword } = req.body;
        const currentUsername = req.user.username;

        // 1. 验证当前用户
        const user = await dbGet('SELECT * FROM admin_users WHERE username = ?', [currentUsername]);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 2. 验证当前密码
        if (user.password !== currentPassword) {
            return res.status(400).json({ error: '当前密码错误' });
        }

        // 3. 如果修改用户名，检查是否重复
        if (newUsername && newUsername !== currentUsername) {
            const existing = await dbGet('SELECT id FROM admin_users WHERE username = ?', [newUsername]);
            if (existing) {
                return res.status(400).json({ error: '用户名已存在' });
            }
        }

        // 4. 更新
        const finalUsername = newUsername || currentUsername;
        const finalPassword = newPassword || user.password;

        await dbRun(
            'UPDATE admin_users SET username = ?, password = ? WHERE id = ?',
            [finalUsername, finalPassword, user.id]
        );

        res.json({ success: true, username: finalUsername });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

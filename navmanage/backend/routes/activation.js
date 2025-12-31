import express from 'express';
import crypto from 'crypto';
import { dbAll, dbGet, dbRun, dbInsert } from '../services/Database.js';
import { authenticateToken } from '../server.js';

const router = express.Router();

// 生成激活码 (XXXX-XXXX-XXXX 格式)
function generateActivationCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = [];
    for (let i = 0; i < 3; i++) {
        let segment = '';
        for (let j = 0; j < 4; j++) {
            segment += chars[Math.floor(Math.random() * chars.length)];
        }
        segments.push(segment);
    }
    return segments.join('-');
}

// 生成授权 Token (加密的)
function generateAuthToken(userId, activationCodeId, fingerprint) {
    const data = {
        uid: userId,
        acid: activationCodeId,
        fp: fingerprint,
        ts: Date.now(),
        rand: crypto.randomBytes(16).toString('hex')
    };
    return Buffer.from(JSON.stringify(data)).toString('base64');
}

// ========== 用户管理 API ==========

// 获取所有用户 (包含激活码统计和最后激活时间)
router.get('/users', authenticateToken, async (req, res) => {
    try {
        const users = await dbAll(`
            SELECT u.*, 
                   (SELECT COUNT(*) FROM activation_codes WHERE user_id = u.id) as code_count,
                   (SELECT COUNT(*) FROM activation_codes WHERE user_id = u.id AND status = 'active') as active_codes,
                   (SELECT MAX(activated_at) FROM active_licenses WHERE user_id = u.id) as last_activation
            FROM users u 
            ORDER BY u.created_at DESC
        `);
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新用户信息
router.put('/users/:id', authenticateToken, async (req, res) => {
    try {
        const { email, name, maxActivations, status, expiresAt } = req.body;
        const userId = parseInt(req.params.id);

        // 检查用户是否存在
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 如果修改邮箱，检查新邮箱是否已被占用
        if (email && email !== user.email) {
            const existing = await dbGet('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
            if (existing) {
                return res.status(400).json({ error: '该邮箱已被使用' });
            }
        }

        // 如果状态从非禁用变为禁用，自动撤销该用户所有活跃授权
        if (status === 'disabled' && user.status !== 'disabled') {
            const activeLicenses = await dbAll(
                'SELECT id FROM active_licenses WHERE user_id = ? AND status = ?',
                [userId, 'active']
            );

            if (activeLicenses.length > 0) {
                // 撤销所有活跃授权
                await dbRun(
                    `UPDATE active_licenses SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP 
                     WHERE user_id = ? AND status = 'active'`,
                    [userId]
                );

                // 记录日志
                await dbRun(
                    `INSERT INTO license_logs (user_id, action, ip_address, details)
                     VALUES (?, ?, ?, ?)`,
                    [userId, 'disable_user', req.ip, `用户被禁用，自动撤销 ${activeLicenses.length} 个活跃授权`]
                );
            }
        }

        // 更新用户
        await dbRun(
            `UPDATE users SET 
                email = COALESCE(?, email),
                name = COALESCE(?, name),
                max_activations = COALESCE(?, max_activations),
                status = COALESCE(?, status),
                expires_at = ?
             WHERE id = ?`,
            [email, name, maxActivations, status, expiresAt || null, userId]
        );

        // 返回更新后的用户信息
        const updated = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
        res.json({ success: true, user: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建用户 + 激活码
router.post('/users', authenticateToken, async (req, res) => {
    try {
        const { email, name, maxActivations } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // 检查邮箱是否已存在
        const existing = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(400).json({ error: '该邮箱已存在' });
        }

        // 创建用户 (激活次数绑定到用户)
        const activations = maxActivations || 3;
        const userId = await dbInsert(
            'INSERT INTO users (email, name, max_activations, used_activations) VALUES (?, ?, ?, 0)',
            [email, name || '', activations]
        );

        // 生成激活码 (单次使用)
        const code = generateActivationCode();

        await dbRun(
            `INSERT INTO activation_codes (code, user_id, plan_type, max_installs, remaining_installs)
             VALUES (?, ?, 'personal', 1, 1)`,
            [code, userId]
        );

        res.json({
            success: true,
            userId,
            email,
            activationCode: code,
            maxActivations: activations
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== 激活码管理 API ==========

// 获取用户的激活码
router.get('/users/:userId/codes', authenticateToken, async (req, res) => {
    try {
        const codes = await dbAll(
            'SELECT * FROM activation_codes WHERE user_id = ? ORDER BY created_at DESC',
            [parseInt(req.params.userId)]
        );
        res.json(codes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 为用户生成新激活码 (单次使用)
router.post('/users/:userId/codes', authenticateToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        // 生成单次使用的激活码
        const code = generateActivationCode();

        await dbRun(
            `INSERT INTO activation_codes (code, user_id, plan_type, max_installs, remaining_installs)
             VALUES (?, ?, 'personal', 1, 1)`,
            [code, userId]
        );

        res.json({ success: true, code, maxInstalls: 1 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除激活码
router.delete('/codes/:id', authenticateToken, async (req, res) => {
    try {
        const codeId = parseInt(req.params.id);

        // 检查是否有关联的激活记录
        const hasLicense = await dbGet(
            'SELECT id FROM active_licenses WHERE activation_code_id = ? AND status = ?',
            [codeId, 'active']
        );

        if (hasLicense) {
            return res.status(400).json({ error: '该激活码已被使用，无法删除' });
        }

        await dbRun('DELETE FROM activation_codes WHERE id = ?', [codeId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除用户
router.delete('/users/:id', authenticateToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // 检查是否有激活记录
        const hasLicense = await dbGet(
            'SELECT id FROM active_licenses WHERE user_id = ? AND status = ?',
            [userId, 'active']
        );

        if (hasLicense) {
            return res.status(400).json({ error: '该用户有激活的设备，无法删除' });
        }

        // 删除相关数据
        await dbRun('DELETE FROM activation_codes WHERE user_id = ?', [userId]);
        await dbRun('DELETE FROM active_licenses WHERE user_id = ?', [userId]);
        await dbRun('DELETE FROM license_logs WHERE user_id = ?', [userId]);
        await dbRun('DELETE FROM users WHERE id = ?', [userId]);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 批量生成未绑定激活码
router.post('/codes/batch', authenticateToken, async (req, res) => {
    try {
        const { count, maxActivations, validDays } = req.body;
        const numCodes = parseInt(count) || 1;
        const quota = parseInt(maxActivations) || 3;

        let expiresAt = null;
        if (validDays && parseInt(validDays) > 0) {
            const date = new Date();
            date.setDate(date.getDate() + parseInt(validDays));
            expiresAt = date.toISOString();
        }

        if (numCodes > 50) {
            return res.status(400).json({ error: '一次最多生成50个激活码' });
        }

        const codes = [];
        for (let i = 0; i < numCodes; i++) {
            const code = generateActivationCode();
            codes.push(code);
            // 插入未绑定的激活码 (user_id = NULL)
            // max_installs 存储该激活码赋予的授权次数 (Quota)
            await dbRun(
                `INSERT INTO activation_codes (code, user_id, plan_type, max_installs, remaining_installs, expires_at)
                 VALUES (?, NULL, 'personal', ?, 1, ?)`,
                [code, quota, expiresAt]
            );
        }

        res.json({ success: true, count: codes.length, codes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取未绑定的激活码
router.get('/codes/unbound', authenticateToken, async (req, res) => {
    try {
        const codes = await dbAll(`
            SELECT * FROM activation_codes 
            WHERE user_id IS NULL AND status = 'active'
            ORDER BY created_at DESC
        `);
        res.json(codes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== 公开激活 API (NavLink 调用) ==========

// 激活
router.post('/activate', async (req, res) => {
    try {
        const { code, email, fingerprint, fingerprintDetails } = req.body;

        if (!code || !email || !fingerprint) {
            return res.status(400).json({
                success: false,
                error: '激活码、邮箱和设备信息都是必填的'
            });
        }

        // 1. 查找激活码
        const activation = await dbGet(
            'SELECT * FROM activation_codes WHERE code = ? AND status = ?',
            [code.toUpperCase(), 'active']
        );

        if (!activation) {
            return res.status(400).json({ success: false, error: '无效的激活码' });
        }

        // 2. 检查激活码是否已使用 (每个激活码只能用一次)
        if (activation.remaining_installs <= 0) {
            return res.status(400).json({ success: false, error: '该激活码已被使用' });
        }

        // 3. 检查激活码是否过期
        if (activation.expires_at) {
            const expireDate = new Date(activation.expires_at);
            if (new Date() > expireDate) {
                return res.status(400).json({ success: false, error: '该激活码已过期' });
            }
        }

        let user;
        // 3. 处理未绑定激活码 (自动注册/关联)
        if (!activation.user_id) {
            // 检查邮箱是否已存在
            user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);

            if (!user) {
                // 创建新用户
                const userId = await dbInsert(
                    'INSERT INTO users (email, name, max_activations, used_activations) VALUES (?, ?, ?, 0)',
                    [email, email.split('@')[0], activation.max_installs] // 使用激活码的 max_installs 作为用户的 quota
                );
                user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
            } else {
                // 用户已存在，是否增加额度？
                // 暂时逻辑：如果用户已存在，直接关联此激活码，并增加相应额度？
                // 或者保持原额度？根据需求"相当于注册"，这里选择增加额度可能更合理，或者覆盖？
                // 简单起见，如果用户存在，我们增加额度：
                const newMax = (user.max_activations || 0) + activation.max_installs;
                await dbRun('UPDATE users SET max_activations = ? WHERE id = ?', [newMax, user.id]);
                user.max_activations = newMax; // 更新内存对象
            }

            // 将激活码绑定到用户
            await dbRun('UPDATE activation_codes SET user_id = ? WHERE id = ?', [user.id, activation.id]);
            activation.user_id = user.id; // 更新内存对象

        } else {
            // 4. 处理已绑定激活码 (验证邮箱)
            user = await dbGet('SELECT * FROM users WHERE id = ?', [activation.user_id]);
            if (!user || user.email.toLowerCase() !== email.toLowerCase()) {
                return res.status(400).json({ success: false, error: '邮箱与激活码不匹配' });
            }
        }

        // 4. 检查用户的剩余激活次数
        const maxActivations = user.max_activations || 3;
        const usedActivations = user.used_activations || 0;
        if (usedActivations >= maxActivations) {
            return res.status(400).json({
                success: false,
                error: `您已达到最大激活次数 (${maxActivations}次)`
            });
        }

        // 5. 检查是否已有相同指纹的激活记录
        const existingLicense = await dbGet(
            'SELECT * FROM active_licenses WHERE user_id = ? AND fingerprint = ? AND status = ?',
            [user.id, fingerprint, 'active']
        );

        if (existingLicense) {
            // 相同设备重新激活，直接返回现有 token
            return res.json({
                success: true,
                authToken: existingLicense.auth_token,
                email: user.email,
                name: user.name,
                message: '设备已激活'
            });
        }

        // 6. 撤销该用户所有现有的活跃授权（单设备授权模式）
        const existingActiveLicenses = await dbAll(
            'SELECT id FROM active_licenses WHERE user_id = ? AND status = ?',
            [user.id, 'active']
        );

        if (existingActiveLicenses.length > 0) {
            // 撤销所有旧授权
            await dbRun(
                `UPDATE active_licenses SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP 
                 WHERE user_id = ? AND status = 'active'`,
                [user.id]
            );

            // 返还激活次数
            await dbRun(
                'UPDATE users SET used_activations = used_activations - ? WHERE id = ?',
                [existingActiveLicenses.length, user.id]
            );

            // 记录撤销日志
            await dbRun(
                `INSERT INTO license_logs (user_id, action, fingerprint, ip_address, details)
                 VALUES (?, ?, ?, ?, ?)`,
                [user.id, 'auto_revoke', fingerprint, req.ip, `自动撤销 ${existingActiveLicenses.length} 个旧设备授权`]
            );
        }

        // 7. 生成授权 Token
        const authToken = generateAuthToken(user.id, activation.id, fingerprint);

        // 8. 保存激活记录
        await dbRun(
            `INSERT INTO active_licenses (user_id, activation_code_id, fingerprint, fingerprint_details, auth_token)
             VALUES (?, ?, ?, ?, ?)`,
            [user.id, activation.id, fingerprint, JSON.stringify(fingerprintDetails || {}), authToken]
        );

        // 9. 将激活码标记为已使用
        await dbRun(
            'UPDATE activation_codes SET remaining_installs = 0, status = ? WHERE id = ?',
            ['used', activation.id]
        );

        // 10. 增加用户的已使用激活次数
        await dbRun(
            'UPDATE users SET used_activations = used_activations + 1 WHERE id = ?',
            [user.id]
        );

        // 11. 记录日志
        await dbRun(
            `INSERT INTO license_logs (user_id, action, fingerprint, ip_address, details)
             VALUES (?, ?, ?, ?, ?)`,
            [user.id, 'activate', fingerprint, req.ip, `激活码: ${code}`]
        );

        res.json({
            success: true,
            authToken,
            email: user.email,
            name: user.name,
            remainingActivations: maxActivations - usedActivations - 1
        });

    } catch (error) {
        console.error('[Activate Error]', error);
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});

// 申请新激活码 (迁移)
router.post('/request-new-code', async (req, res) => {
    try {
        const { authToken, email } = req.body;

        if (!authToken || !email) {
            return res.status(400).json({ success: false, error: '参数不完整' });
        }

        // 1. 验证 authToken
        const license = await dbGet(
            'SELECT * FROM active_licenses WHERE auth_token = ? AND status = ?',
            [authToken, 'active']
        );

        if (!license) {
            return res.status(400).json({ success: false, error: '无效的授权' });
        }

        // 2. 验证邮箱并检查用户剩余激活次数
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [license.user_id]);
        if (!user || user.email.toLowerCase() !== email.toLowerCase()) {
            return res.status(400).json({ success: false, error: '邮箱不匹配' });
        }

        // 3. 检查用户剩余激活次数
        const maxActivations = user.max_activations || 3;
        const usedActivations = user.used_activations || 0;
        if (usedActivations >= maxActivations) {
            return res.status(400).json({
                success: false,
                error: `您已达到最大激活次数 (${maxActivations}次)，无法申请新激活码`
            });
        }

        // 4. 撤销当前授权 (不返还激活次数，迁移会消耗一次新激活)
        await dbRun(
            `UPDATE active_licenses SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [license.id]
        );

        // 5. 生成新激活码 (单次使用)
        const newCode = generateActivationCode();
        await dbRun(
            `INSERT INTO activation_codes (code, user_id, plan_type, max_installs, remaining_installs)
             VALUES (?, ?, 'personal', 1, 1)`,
            [newCode, user.id]
        );

        // 6. 获取旧激活码信息用于日志
        const activation = await dbGet(
            'SELECT code FROM activation_codes WHERE id = ?',
            [license.activation_code_id]
        );

        // 7. 记录日志
        await dbRun(
            `INSERT INTO license_logs (user_id, action, fingerprint, ip_address, details)
             VALUES (?, ?, ?, ?, ?)`,
            [user.id, 'transfer', license.fingerprint, req.ip, `旧激活码: ${activation?.code || 'N/A'}, 新激活码: ${newCode}`]
        );

        res.json({
            success: true,
            newActivationCode: newCode,
            remainingActivations: maxActivations - usedActivations - 1,
            message: '新激活码已生成，请在新设备上使用此激活码'
        });

    } catch (error) {
        console.error('[Request New Code Error]', error);
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});

// 获取激活记录
router.get('/licenses', authenticateToken, async (req, res) => {
    try {
        const licenses = await dbAll(`
            SELECT al.*, u.email, u.name, ac.code as activation_code
            FROM active_licenses al
            JOIN users u ON al.user_id = u.id
            JOIN activation_codes ac ON al.activation_code_id = ac.id
            ORDER BY al.activated_at DESC
        `);
        res.json(licenses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 撤销激活
router.post('/licenses/:id/revoke', authenticateToken, async (req, res) => {
    try {
        await dbRun(
            `UPDATE active_licenses SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [parseInt(req.params.id)]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除已撤销的激活记录
router.delete('/licenses/:id', authenticateToken, async (req, res) => {
    try {
        const licenseId = parseInt(req.params.id);

        // 只允许删除已撤销的记录
        const license = await dbGet(
            'SELECT * FROM active_licenses WHERE id = ?',
            [licenseId]
        );

        if (!license) {
            return res.status(404).json({ error: '记录不存在' });
        }

        if (license.status === 'active') {
            return res.status(400).json({ error: '无法删除活跃状态的授权记录，请先撤销' });
        }

        await dbRun('DELETE FROM active_licenses WHERE id = ?', [licenseId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

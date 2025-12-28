import express from 'express';
import { dbAll, dbGet, dbRun, dbInsert } from '../services/Database.js';
import { licenseGenerator } from '../services/LicenseGenerator.js';
import { authenticateToken } from '../server.js';

const router = express.Router();

// ========== 公开 API (无需认证) ==========

// 获取公钥 (供 NavLink 配置) - 必须在 /:id 之前
router.get('/public-key', (req, res) => {
    res.json({ publicKey: licenseGenerator.getPublicKey() });
});

// 验证 License
router.post('/verify', async (req, res) => {
    try {
        const { licenseKey } = req.body;

        if (!licenseKey) {
            return res.status(400).json({ valid: false, error: 'licenseKey required' });
        }

        const result = licenseGenerator.verify(licenseKey);

        // 检查是否在数据库中被撤销
        if (result.valid) {
            const dbLicense = await dbGet('SELECT status FROM licenses WHERE license_key = ?', [licenseKey]);
            if (dbLicense && dbLicense.status === 'revoked') {
                return res.json({ valid: false, error: 'License has been revoked' });
            }
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ valid: false, error: error.message });
    }
});

// 升级前验证授权状态 (供 NavLink 升级前调用)
router.post('/validate', async (req, res) => {
    try {
        const { email, fingerprint } = req.body;

        if (!email) {
            return res.json({
                valid: false,
                status: 'invalid_request',
                shouldClear: false,
                message: '缺少验证参数'
            });
        }

        // 查询用户
        const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);

        if (!user) {
            return res.json({
                valid: false,
                status: 'not_found',
                shouldClear: true,
                message: '未找到用户记录，请重新激活'
            });
        }

        // 检查用户状态
        if (user.status === 'disabled') {
            return res.json({
                valid: false,
                status: 'disabled',
                shouldClear: true,
                message: '账户已被禁用'
            });
        }

        // 检查是否过期
        if (user.expires_at) {
            const expireDate = new Date(user.expires_at);
            if (new Date() > expireDate) {
                return res.json({
                    valid: false,
                    status: 'expired',
                    shouldClear: false,  // 过期不清除许可
                    message: '授权已过期，请续费后再升级'
                });
            }
        }

        // 验证通过
        return res.json({
            valid: true,
            status: 'active',
            shouldClear: false,
            message: '授权有效'
        });

    } catch (error) {
        console.error('[License Validate]', error);
        res.status(500).json({
            valid: false,
            status: 'error',
            shouldClear: false,
            message: '服务器错误'
        });
    }
});

// ========== 需要认证的 API ==========

// 获取所有 License
router.get('/', authenticateToken, async (req, res) => {
    try {
        const licenses = await dbAll('SELECT * FROM licenses ORDER BY created_at DESC');
        res.json(licenses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 生成新 License
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { instanceId, issuedTo, expiresAt, features, notes } = req.body;

        if (!instanceId || !issuedTo) {
            return res.status(400).json({ error: 'instanceId and issuedTo are required' });
        }

        // 生成 License
        const { licenseKey, licenseData } = licenseGenerator.generate(
            instanceId,
            issuedTo,
            expiresAt || '2099-12-31T23:59:59Z',
            features || ['all']
        );

        // 保存到数据库
        const id = await dbInsert(
            `INSERT INTO licenses (license_key, instance_id, issued_to, expires_at, features, notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                licenseKey,
                instanceId,
                issuedTo,
                expiresAt || '2099-12-31T23:59:59Z',
                JSON.stringify(features || ['all']),
                notes || ''
            ]
        );

        res.json({
            success: true,
            id,
            licenseKey,
            licenseData
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取单个 License
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const license = await dbGet('SELECT * FROM licenses WHERE id = ?', [parseInt(req.params.id)]);
        if (!license) {
            return res.status(404).json({ error: 'License not found' });
        }
        res.json(license);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新 License
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { status, notes } = req.body;
        await dbRun('UPDATE licenses SET status = ?, notes = ? WHERE id = ?', [status, notes, parseInt(req.params.id)]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 撤销 License
router.post('/:id/revoke', authenticateToken, async (req, res) => {
    try {
        await dbRun(`UPDATE licenses SET status = 'revoked' WHERE id = ?`, [parseInt(req.params.id)]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除 License
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        await dbRun('DELETE FROM licenses WHERE id = ?', [parseInt(req.params.id)]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;


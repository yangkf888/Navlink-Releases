/**
 * 授权服务 (License Service) - 新版
 * 基于在线激活 + 硬件指纹绑定
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { fingerprintService } from './FingerprintService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'navlink.db');

class LicenseService {
    constructor() {
        this.db = null;
        this.isValid = false;
        this.licenseInfo = null;
        this.fingerprint = null;
    }

    /**
     * 获取数据库连接
     */
    getDb() {
        if (!this.db) {
            this.db = new Database(DB_PATH);
            this.db.pragma('journal_mode = WAL');
        }
        return this.db;
    }

    /**
     * 初始化服务
     */
    async init() {
        // 确保 license_auth 表存在
        this.ensureTable();

        // 获取当前指纹
        this.fingerprint = fingerprintService.getFingerprint();

        // 检查授权
        this.checkLicense();

        console.log('[LicenseService] Initialized, valid:', this.isValid);
    }

    /**
     * 确保授权表存在
     */
    ensureTable() {
        try {
            const db = this.getDb();
            db.exec(`
                CREATE TABLE IF NOT EXISTS license_auth (
                    id INTEGER PRIMARY KEY,
                    auth_token TEXT NOT NULL,
                    fingerprint TEXT NOT NULL,
                    user_email TEXT,
                    activated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);
        } catch (error) {
            console.error('[LicenseService] Failed to create table:', error);
        }
    }

    /**
     * 检查授权状态
     */
    checkLicense() {
        try {
            const db = this.getDb();
            const license = db.prepare('SELECT * FROM license_auth LIMIT 1').get();

            if (!license) {
                // 无授权记录 → 需要激活
                this.isValid = false;
                this.licenseInfo = null;
                console.log('[LicenseService] No license found, activation required');
                return;
            }

            // 对比硬件指纹
            const currentFp = this.fingerprint.hash;
            const storedFp = license.fingerprint;

            if (currentFp !== storedFp) {
                // 硬件变化 → 清除授权
                console.warn('[LicenseService] Hardware fingerprint mismatch!');
                console.warn(`  Stored: ${storedFp}`);
                console.warn(`  Current: ${currentFp}`);

                this.clearLicense();
                this.isValid = false;
                this.licenseInfo = null;
                return;
            }

            // 授权有效
            this.isValid = true;
            this.licenseInfo = {
                email: license.user_email,
                activatedAt: license.activated_at
            };
            console.log('[LicenseService] License valid for:', license.user_email);

        } catch (error) {
            console.error('[LicenseService] Check error:', error);
            this.isValid = false;
        }
    }

    /**
     * 获取授权状态
     */
    getStatus() {
        return {
            valid: this.isValid,
            needsActivation: !this.isValid,
            fingerprint: this.fingerprint?.hash,
            license: this.licenseInfo
        };
    }

    /**
     * 激活授权 (调用 NavManage 平台)
     */
    async activate(code, email, navmanageUrl) {
        try {
            const fingerprint = fingerprintService.getFingerprint();

            const response = await fetch(`${navmanageUrl}/api/activation/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code,
                    email,
                    fingerprint: fingerprint.hash,
                    fingerprintDetails: fingerprint.factors
                })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || '激活失败');
            }

            // 保存授权到本地
            this.saveLicense(data.authToken, fingerprint.hash, email);

            // 更新状态
            this.isValid = true;
            this.fingerprint = fingerprint;
            this.licenseInfo = { email, activatedAt: new Date().toISOString() };

            return { success: true, email: data.email, name: data.name };

        } catch (error) {
            console.error('[LicenseService] Activation error:', error);
            throw error;
        }
    }

    /**
     * 保存授权到数据库
     */
    saveLicense(authToken, fingerprint, email) {
        const db = this.getDb();

        // 清除旧记录
        db.prepare('DELETE FROM license_auth').run();

        // 插入新记录
        db.prepare(
            `INSERT INTO license_auth (auth_token, fingerprint, user_email) VALUES (?, ?, ?)`
        ).run(authToken, fingerprint, email);
    }

    /**
     * 清除授权
     */
    clearLicense() {
        try {
            const db = this.getDb();
            db.prepare('DELETE FROM license_auth').run();
            this.isValid = false;
            this.licenseInfo = null;
            console.log('[LicenseService] License cleared');
        } catch (error) {
            console.error('[LicenseService] Clear error:', error);
        }
    }

    /**
     * 申请迁移码
     */
    async requestNewCode(email, navmanageUrl) {
        try {
            const db = this.getDb();
            const license = db.prepare('SELECT auth_token FROM license_auth LIMIT 1').get();

            if (!license) {
                throw new Error('当前没有有效授权');
            }

            const response = await fetch(`${navmanageUrl}/api/activation/request-new-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    authToken: license.auth_token,
                    email
                })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || '申请失败');
            }

            // 清除本地授权
            this.clearLicense();

            return { success: true, newActivationCode: data.newActivationCode };

        } catch (error) {
            console.error('[LicenseService] Request new code error:', error);
            throw error;
        }
    }
}

export const licenseService = new LicenseService();

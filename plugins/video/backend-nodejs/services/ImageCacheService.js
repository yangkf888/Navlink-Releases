const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const sharp = require('sharp');

// 缓存目录配置 - 存放在主程序的 data 目录下
const CACHE_DIR = path.join(process.cwd(), 'data', 'cache', 'video_covers');

// Video 2.0: 失败名单配置
const FAIL_THRESHOLD = 3;           // 失败次数阈值
const FAIL_COOLDOWN = 24 * 60 * 60 * 1000; // 24 小时冷却期

class ImageCacheService {
    constructor() {
        // Video 2.0: 失败名单 Map<url, {count, lastFail}>
        this.failedUrls = new Map();
        this.ensureCacheDir();
    }

    ensureCacheDir() {
        if (!fs.existsSync(CACHE_DIR)) {
            try {
                fs.mkdirSync(CACHE_DIR, { recursive: true });
                console.log(`[ImageCache] Created cache directory: ${CACHE_DIR}`);
            } catch (err) {
                console.error(`[ImageCache] Failed to create cache dir:`, err.message);
            }
        }
    }

    /**
     * Video 2.0: 检查 URL 是否在失败名单中
     */
    _isInDeathList(url) {
        const record = this.failedUrls.get(url);
        if (!record) return false;

        // 检查冷却期
        if (Date.now() - record.lastFail > FAIL_COOLDOWN) {
            this.failedUrls.delete(url);
            return false;
        }

        return record.count >= FAIL_THRESHOLD;
    }

    /**
     * Video 2.0: 记录失败
     */
    _recordFailure(url) {
        const record = this.failedUrls.get(url) || { count: 0, lastFail: 0 };
        record.count += 1;
        record.lastFail = Date.now();
        this.failedUrls.set(url, record);

        if (record.count >= FAIL_THRESHOLD) {
            console.log(`[ImageCache] URL added to death list: ${url.substring(0, 100)}...`);
        }
    }

    /**
     * 获取缓存后的图片路径
     * @param {string} imageUrl 原始图片 URL 或网盘路径
     * @param {object} headers 请求原始图片所需的 Headers
     */
    async getCachedImage(imageUrl, headers = {}) {
        if (!imageUrl) return null;

        // Video 2.0: 检查失败名单
        if (this._isInDeathList(imageUrl)) {
            return null;
        }

        // 1. 生成唯一的 Cache Key (MD5)
        const hash = crypto.createHash('md5').update(imageUrl).digest('hex');
        const cachePath = path.join(CACHE_DIR, `${hash}.webp`);

        // 2. 检查缓存命中
        if (fs.existsSync(cachePath)) {
            const stats = fs.statSync(cachePath);
            if (stats.size > 0) {
                // Video 2.0: 增加 WebP 格式校验 (检查文件头部 Magic Number)
                try {
                    const fd = fs.openSync(cachePath, 'r');
                    const buffer = Buffer.alloc(12);
                    fs.readSync(fd, buffer, 0, 12, 0);
                    fs.closeSync(fd);
                    // WebP 格式: RIFF....WEBP
                    const isValidWebP = buffer.toString('ascii', 0, 4) === 'RIFF' &&
                        buffer.toString('ascii', 8, 12) === 'WEBP';
                    if (isValidWebP) {
                        return cachePath;
                    } else {
                        // 文件损坏，删除后重新下载
                        console.warn(`[ImageCache] Corrupted cache file detected, re-downloading: ${cachePath}`);
                        fs.unlinkSync(cachePath);
                    }
                } catch (e) {
                    // 校验失败，尝试删除并重下
                    try { fs.unlinkSync(cachePath); } catch (e2) { }
                }
            }
        }

        // 3. 缓存未命中，下载并处理
        try {
            // 安全编码：处理中文、空格、特殊字符 (# 等)
            let safeUrl = imageUrl;
            try {
                let decoded = imageUrl;
                for (let i = 0; i < 3; i++) {
                    const temp = decodeURIComponent(decoded);
                    if (temp === decoded) break;
                    decoded = temp;
                }

                // 核心修复：把路径中的 # 替换为 %23，防止 new URL() 将其识别为 Fragment 而丢弃
                const preparedUrl = decoded.replace(/#/g, '%23');
                safeUrl = new URL(preparedUrl).href;
            } catch (e) {
                // 极端情况下的兜底，避免双重编码现有的百分号
                safeUrl = imageUrl.indexOf('%') !== -1 ? imageUrl : encodeURI(imageUrl).replace(/#/g, '%23');
            }

            console.log(`[ImageCache] Cache miss: ${safeUrl.substring(0, 150)}...`);
            const response = await axios({
                url: safeUrl,
                method: 'GET',
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    ...headers
                },
                timeout: 10000
            });

            if (response.status !== 200) {
                throw new Error(`HTTP ${response.status}`);
            }

            // 4. 使用 Sharp 进行压缩与并转换为 WebP
            // 设定最大宽度 480px (兼容高分屏)，质量 85，平衡清晰度与体积
            const processedBuffer = await sharp(response.data)
                .resize({ width: 480, withoutEnlargement: true })
                .webp({ quality: 85 })
                .toBuffer();

            // 5. Video 2.0: 原子化写入 (先写临时文件再重命名)
            const tempPath = cachePath + '.tmp';
            fs.writeFileSync(tempPath, processedBuffer);
            fs.renameSync(tempPath, cachePath);

            return cachePath;
        } catch (err) {
            console.error(`[ImageCache] Error processing ${imageUrl.substring(0, 200)}:`, err.message);
            // Video 2.0: 记录失败
            this._recordFailure(imageUrl);
            return null;
        }
    }

    /**
     * 清理所有缓存文件
     */
    async clearAllCache() {
        if (fs.existsSync(CACHE_DIR)) {
            try {
                const files = fs.readdirSync(CACHE_DIR);
                for (const file of files) {
                    fs.unlinkSync(path.join(CACHE_DIR, file));
                }
                console.log(`[ImageCache] Cleared ${files.length} cache files.`);
            } catch (err) {
                console.error(`[ImageCache] Failed to clear cache:`, err.message);
            }
        }
    }
}

module.exports = new ImageCacheService();

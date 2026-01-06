const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const sharp = require('sharp');

// 缓存目录配置 - 存放在主程序的 data 目录下
const CACHE_DIR = path.join(process.cwd(), 'data', 'cache', 'video_covers');

class ImageCacheService {
    constructor() {
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
     * 获取缓存后的图片路径
     * @param {string} imageUrl 原始图片 URL 或网盘路径
     * @param {object} headers 请求原始图片所需的 Headers
     */
    async getCachedImage(imageUrl, headers = {}) {
        if (!imageUrl) return null;

        // 1. 生成唯一的 Cache Key (MD5)
        const hash = crypto.createHash('md5').update(imageUrl).digest('hex');
        const cachePath = path.join(CACHE_DIR, `${hash}.webp`);

        // 2. 检查缓存命中
        if (fs.existsSync(cachePath)) {
            const stats = fs.statSync(cachePath);
            if (stats.size > 0) {
                return cachePath;
            }
        }

        // 3. 缓存未抢中，下载并处理
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

            // 5. 写入磁盘
            fs.writeFileSync(cachePath, processedBuffer);
            return cachePath;
        } catch (err) {
            console.error(`[ImageCache] Error processing ${imageUrl.substring(0, 200)}:`, err.message);
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

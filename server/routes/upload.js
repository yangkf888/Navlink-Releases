import express from 'express';
import multer from 'multer';
import path from 'path';
import axios from 'axios';
import https from 'https';
import fs from 'fs/promises';
import { UPLOAD_DIR } from '../config.js';
import { ensureUploadDir } from '../utils/fileHelper.js';
import { authenticateToken } from '../middleware/auth.js';
import { ConfigService } from '../services/ConfigService.js';

const router = express.Router();

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: async (req, file, cb) => {
        // 清理文件名：移除特殊字符，保留字母、数字、下划线、连字符和点
        const sanitizedName = file.originalname
            .replace(/[^\w\s.-]/g, '') // 移除特殊字符
            .replace(/\s+/g, '_');      // 空格替换为下划线

        const ext = path.extname(sanitizedName);
        const nameWithoutExt = path.basename(sanitizedName, ext);

        // 检查文件是否已存在，如果存在则添加数字后缀
        let finalName = sanitizedName;
        let counter = 1;

        try {
            const fs = await import('fs/promises');
            while (await fs.access(path.join(UPLOAD_DIR, finalName)).then(() => true).catch(() => false)) {
                finalName = `${nameWithoutExt}_${counter}${ext}`;
                counter++;
            }
        } catch (error) {
            // 如果检查失败，使用原始清理后的文件名
        }

        cb(null, finalName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// API: Upload Image
router.post('/upload', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ url: imageUrl });
});

// API: Download Remote Icon
router.post('/download-icon', authenticateToken, async (req, res) => {
    const { iconUrl } = req.body;

    if (!iconUrl) {
        return res.status(400).json({ error: 'Icon URL is required' });
    }

    try {
        await ensureUploadDir();

        let targetIconUrl = iconUrl;

        // 🚀 核心优化：如果 iconUrl 看起来像是一个网站首页（而非图片文件）
        // 则尝试通过抓取 HTML 提取真正的 Favicon
        const isLikelyPage = !/\.(png|jpg|jpeg|gif|svg|ico|webp)$/i.test(new URL(iconUrl).pathname);

        if (isLikelyPage) {
            try {
                const pageRes = await axios.get(iconUrl, { timeout: 5000, responseType: 'text' });
                const html = pageRes.data;
                // 用正则简单提取 <link rel="icon" href="..."> 或 apple-touch-icon
                const match = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i) ||
                    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);

                if (match && match[1]) {
                    let favPath = match[1];
                    if (favPath.startsWith('//')) {
                        favPath = 'https:' + favPath;
                    } else if (favPath.startsWith('/')) {
                        const urlObj = new URL(iconUrl);
                        favPath = urlObj.origin + favPath;
                    } else if (!favPath.startsWith('http')) {
                        const urlObj = new URL(iconUrl);
                        favPath = urlObj.origin + '/' + favPath;
                    }
                    targetIconUrl = favPath;
                } else {
                    // Fallback: 尝试直接访问根目录的 favicon.ico
                    const urlObj = new URL(iconUrl);
                    targetIconUrl = `${urlObj.origin}/favicon.ico`;
                }
            } catch (e) {
                console.warn('Failed to parse page for icon, defaulting to root favicon.ico');
                const urlObj = new URL(iconUrl);
                targetIconUrl = `${urlObj.origin}/favicon.ico`;
            }
        }

        const agent = new https.Agent({ rejectUnauthorized: false });
        const response = await axios.get(targetIconUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
            httpsAgent: agent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Referer': new URL(iconUrl).origin
            }
        });

        const contentType = response.headers['content-type'] || '';
        // 如果是 HTML 说明下载的还是页面，不是图标
        if (contentType.includes('text/html')) {
            throw new Error('Downloaded content is HTML, not an image');
        }

        let ext = '.png';
        if (contentType.includes('webp')) ext = '.webp';
        else if (contentType.includes('svg')) ext = '.svg';
        else if (contentType.includes('gif')) ext = '.gif';
        else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
        else if (contentType.includes('x-icon') || contentType.includes('vnd.microsoft.icon')) ext = '.ico';

        const filename = `icon-${Date.now()}${ext}`;
        const filepath = path.join(UPLOAD_DIR, filename);

        await fs.writeFile(filepath, response.data);

        const localUrl = `/uploads/${filename}`;
        res.json({ url: localUrl });
    } catch (error) {
        console.error('Download icon error:', error.message);
        res.status(500).json({ error: 'Failed to download icon: ' + error.message });
    }
});

// API: List Uploads
router.get('/uploads', authenticateToken, async (req, res) => {
    try {
        await ensureUploadDir();
        const fileNames = await fs.readdir(UPLOAD_DIR);

        const fileDetails = await Promise.all(
            fileNames.map(async (filename) => {
                try {
                    const filepath = path.join(UPLOAD_DIR, filename);
                    const stats = await fs.stat(filepath);

                    if (filename.startsWith('.')) return null;

                    return {
                        filename: filename,
                        size: stats.size,
                        path: `/uploads/${filename}`,
                        uploadedAt: stats.birthtime.toISOString(),
                        modifiedAt: stats.mtime.toISOString()
                    };
                } catch (error) {
                    return null;
                }
            })
        );

        const validFiles = fileDetails
            .filter(f => f !== null)
            .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

        const totalSize = validFiles.reduce((sum, f) => sum + f.size, 0);
        const stats = {
            totalFiles: validFiles.length,
            totalSize: totalSize,
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
        };

        res.json({ files: validFiles, stats });
    } catch (error) {
        console.error('List uploads error:', error);
        res.status(500).json({ error: 'Failed to list uploads' });
    }
});

// API: Delete File
router.delete('/uploads/:filename', authenticateToken, async (req, res) => {
    try {
        const filename = req.params.filename;
        if (filename.includes('..') || filename.includes('/')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        const filepath = path.join(UPLOAD_DIR, filename);
        await fs.unlink(filepath);

        res.json({ success: true, message: 'File deleted' });
    } catch (error) {
        console.error('Delete upload error:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// API: Get File References
router.get('/uploads/:filename/references', authenticateToken, async (req, res) => {
    try {
        const filename = req.params.filename;
        const fileUrl = `/uploads/${filename}`;
        const references = [];
        let usageCount = 0;

        try {
            // 从数据库读取配置
            const configService = new ConfigService();
            const config = await configService.getFullConfig();

            if (config) {
                // 1. 检查 Logo
                if (config.logoUrl === fileUrl) {
                    references.push({ location: '网站Logo', type: 'logo' });
                    usageCount++;
                }

                // 2. 检查背景图片
                if (config.backgroundImage === fileUrl) {
                    references.push({ location: '首屏背景图片', type: 'background' });
                    usageCount++;
                }

                // 3. 检查侧边栏头像
                if (config.rightSidebar?.profile?.avatarUrl === fileUrl) {
                    references.push({ location: '侧边栏头像', type: 'avatar' });
                    usageCount++;
                }

                // 4. 检查热门推广 (promo)
                if (config.promo && Array.isArray(config.promo)) {
                    config.promo.forEach((tab) => {
                        if (tab.items && Array.isArray(tab.items)) {
                            tab.items.forEach((item) => {
                                if (item.icon === fileUrl) {
                                    references.push({ location: `热门推广: ${tab.name} / ${item.title}`, type: 'promo' });
                                    usageCount++;
                                }
                            });
                        }
                    });
                }

                // 5. 检查分类 (categories)
                if (config.categories && Array.isArray(config.categories)) {
                    config.categories.forEach((cat) => {
                        // 检查分类图标
                        if (cat.icon === fileUrl) {
                            references.push({ location: `分类: ${cat.name}`, type: 'category' });
                            usageCount++;
                        }

                        // 检查分类直接链接
                        if (cat.items && Array.isArray(cat.items)) {
                            cat.items.forEach((item) => {
                                if (item.icon === fileUrl) {
                                    references.push({ location: `${cat.name} / ${item.title}`, type: 'link' });
                                    usageCount++;
                                }
                            });
                        }

                        // 检查子分类链接
                        if (cat.subCategories && Array.isArray(cat.subCategories)) {
                            cat.subCategories.forEach((subCat) => {
                                if (subCat.items && Array.isArray(subCat.items)) {
                                    subCat.items.forEach((item) => {
                                        if (item.icon === fileUrl) {
                                            references.push({ location: `${cat.name} / ${subCat.name} / ${item.title}`, type: 'link' });
                                            usageCount++;
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Check references error:', error);
        }

        res.json({ usageCount, references });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get references' });
    }
});


// API: Batch Delete
router.post('/uploads/batch-delete', authenticateToken, async (req, res) => {
    try {
        const { filenames } = req.body;
        if (!Array.isArray(filenames)) return res.status(400).json({ error: 'Invalid filenames' });

        let deletedCount = 0;
        for (const filename of filenames) {
            try {
                if (filename.includes('..') || filename.includes('/')) continue;
                await fs.unlink(path.join(UPLOAD_DIR, filename));
                deletedCount++;
            } catch (e) { }
        }
        res.json({ success: true, deletedCount });
    } catch (error) {
        res.status(500).json({ error: 'Failed to batch delete' });
    }
});

// API: Rename File
router.post('/uploads/rename', authenticateToken, async (req, res) => {
    try {
        const { oldFilename, newFilename } = req.body;
        if (!oldFilename || !newFilename) return res.status(400).json({ error: 'Missing filename' });
        if (oldFilename.includes('..') || newFilename.includes('/')) return res.status(400).json({ error: 'Invalid filename' });

        const oldPath = path.join(UPLOAD_DIR, oldFilename);
        const newPath = path.join(UPLOAD_DIR, newFilename);

        await fs.rename(oldPath, newPath);
        res.json({ success: true, newFilename });
    } catch (error) {
        res.status(500).json({ error: 'Failed to rename' });
    }
});

export default router;

import express from 'express';
import multer from 'multer';
import path from 'path';
import axios from 'axios';
import https from 'https';
import fs from 'fs/promises';
import { UPLOAD_DIR, DATA_DIR } from '../config.js';
import { ensureUploadDir } from '../utils/fileHelper.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
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

        const agent = new https.Agent({ rejectUnauthorized: false });
        const response = await axios.get(iconUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
            httpsAgent: agent
        });

        const ext = path.extname(new URL(iconUrl).pathname) || '.png';
        const filename = `icon-${Date.now()}${ext}`;
        const filepath = path.join(UPLOAD_DIR, filename);

        await fs.writeFile(filepath, response.data);

        const localUrl = `/uploads/${filename}`;
        res.json({ url: localUrl });
    } catch (error) {
        console.error('Download icon error:', error);
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
            const configPath = path.join(DATA_DIR, 'app_config.json');
            const data = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(data);

            if (config) {
                if (config.logoUrl === fileUrl) {
                    references.push({ location: '网站Logo', type: 'logo' });
                    usageCount++;
                }
                if (config.favicon === fileUrl) {
                    references.push({ location: '网站图标(Favicon)', type: 'favicon' });
                    usageCount++;
                }
                if (config.categories && Array.isArray(config.categories)) {
                    config.categories.forEach((cat) => {
                        if (cat.icon === fileUrl) {
                            references.push({ location: `分类: ${cat.name}`, type: 'category' });
                            usageCount++;
                        }
                        if (cat.items && Array.isArray(cat.items)) {
                            cat.items.forEach((item) => {
                                if (item.icon === fileUrl) {
                                    references.push({ location: `${cat.name} / ${item.title}`, type: 'link' });
                                    usageCount++;
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

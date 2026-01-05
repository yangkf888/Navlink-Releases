
const { initDatabase, getDatabase } = require('./database');
const fetch = require('node-fetch');

async function diagnostic() {
    try {
        console.log('--- Database Initialization ---');
        initDatabase();
        const db = getDatabase();

        const source = db.get('SELECT * FROM netdisk_sources WHERE id = 3');
        if (!source) {
            console.error('Source ID 3 not found in video.db');
            return;
        }

        const auth = Buffer.from(source.username + ':' + (source.password || '')).toString('base64');
        const headers = {
            'Authorization': 'Basic ' + auth,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        };

        // 测试路径
        const failedPath = '/精品收藏/人妻熟女-JP/无码番号分类/未分类/HEYZO-3630 朋友的妈妈太性感了让人无法抗拒Vol.2/HEYZO-3630-无码 朋友的妈妈太性感了让人无法抗拒Vol.2-poster.jpg';

        const cleanPath = failedPath.startsWith('/') ? failedPath : '/' + failedPath;
        // 关键点：PikPak WebDAV 编码测试
        const encodedUrl = source.url.replace(/\/$/, '') + cleanPath.split('/').map(s => encodeURIComponent(s)).join('/');

        console.log('--- Request Logic ---');
        console.log('Clean Path:', cleanPath);
        console.log('Target URL:', encodedUrl);

        const res = await fetch(encodedUrl, {
            method: 'GET',
            headers: headers,
            timeout: 15000
        });

        console.log('Status:', res.status, res.statusText);
        console.log('Response Headers:', JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2));

        const bodyContent = await res.text();
        console.log('Body Preview (500 chars):', bodyContent.substring(0, 500));

        // 如果是 400，尝试另一种编码方式（不编码空格）
        if (res.status === 400) {
            console.log('\n[!] Received 400. Trying alternative encoding (no spaces encoding)...');
            const altUrl = source.url.replace(/\/$/, '') + cleanPath;
            console.log('Alt URL:', altUrl);
            const res2 = await fetch(altUrl, { method: 'GET', headers: headers, timeout: 5000 });
            console.log('Alt Status:', res2.status);
        }

    } catch (e) {
        console.error('Diagnostic failed:', e);
    }
}

diagnostic();

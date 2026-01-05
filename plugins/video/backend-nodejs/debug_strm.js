const fetch = require('node-fetch');

const url = 'http://154.36.153.212:5244/d/pikpak/%E7%B2%BE%E5%93%81%E6%94%B6%E8%97%8F/%E4%BA%BA%E5%A6%BB%E7%86%9F%E5%A5%B3-JP/%E6%97%A0%E7%A0%81%E7%95%AA%E5%8F%B7%E5%88%86%E7%B1%BB/pacopacomama/pacopacomama_071219_130%20%E9%93%83%E6%9C%A8%E9%87%8C%E7%BE%8E%E7%9A%84%E5%85%A8%E9%83%A8/pacopacomama_071219_130-%E6%97%A0%E7%A0%81%20%E9%93%83%E6%9C%A8%E9%87%8C%E7%BE%8E%E7%9A%84%E5%85%A8%E9%83%A8.mp4';

async function test() {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Connection': 'keep-alive',
        'Range': 'bytes=0-100'
    };

    let currentUrl = url;
    let redirectCount = 0;

    console.log('--- Debugging Redirect Chain ---');

    while (redirectCount < 5) {
        console.log(`\n[Step ${redirectCount}] Requesting: ${currentUrl}`);
        const res = await fetch(currentUrl, { method: 'GET', headers, redirect: 'manual' });

        console.log('Status:', res.status);
        console.log('Content-Type:', res.headers.get('content-type'));
        console.log('Content-Range:', res.headers.get('content-range'));
        console.log('Content-Length:', res.headers.get('content-length'));

        if ([301, 302, 303, 307, 308].includes(res.status)) {
            let location = res.headers.get('location');
            if (location) {
                if (!location.startsWith('http')) {
                    location = new URL(location, currentUrl).toString();
                }
                currentUrl = location;
                redirectCount++;
                continue;
            }
        }
        break;
    }
}

test();

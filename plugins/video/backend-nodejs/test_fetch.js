const fetch = require('node-fetch');

const url = 'http://154.36.153.212:5244/d/pikpak/%E7%B2%BE%E5%93%81%E6%94%B6%E8%97%8F/%E4%BA%BA%E5%A6%BB%E7%86%9F%E5%A5%B3-JP/%E6%97%A0%E7%A0%81%E7%95%AA%E5%8F%B7%E5%88%86%E7%B1%BB/pacopacomama/pacopacomama_040419_064%20%E6%AC%A7%E5%B7%B4%E6%95%A3%E6%AD%A5%E3%80%9C%E4%BA%94%E5%8D%81%E8%B7%AF%E7%86%9F%E5%A5%B3%E7%9A%84%E4%B8%B0%E6%BB%A1%E8%82%89%E4%BD%93%E3%80%9C/pacopacomama_040419_064-%E6%97%A0%E7%A0%81%20%E6%AC%A7%E5%B7%B4%E6%95%A3%E6%AD%A5%E3%80%9C%E4%BA%94%E5%8D%81%E8%B7%AF%E7%86%9F%E5%A5%B3%E7%9A%84%E4%B8%B0%E6%BB%A1%E8%82%89%E4%BD%93%E3%80%9C.mp4';

async function test() {
    console.log('--- Test 1: Minimal Headers ---');
    try {
        const res = await fetch(url, { redirect: 'follow' });
        console.log('Status:', res.status);
    } catch (e) {
        console.log('Error:', e.message);
    }

    console.log('\n--- Test 2: Full Headers from Proxy ---');
    try {
        const parsedUrl = new URL(url);
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': parsedUrl.origin + '/',
                'Origin': parsedUrl.origin,
                'Accept': '*/*',
                'Range': 'bytes=0-10'
            },
            redirect: 'follow'
        });
        console.log('Status:', res.status);
        console.log('Content-Type:', res.headers.get('content-type'));
    } catch (e) {
        console.log('Error:', e.message);
    }
}

test();

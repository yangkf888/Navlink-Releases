import axios from 'axios';
import https from 'https';

function ensureProtocol(url) {
    if (!url) return '';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return 'http://' + url;
    }
    return url;
}

/**
 * 检查单个URL的健康状态
 */
export async function checkUrlHealth(url) {
    const startTime = Date.now();
    try {
        const urlToCheck = ensureProtocol(url);
        const agent = new https.Agent({ rejectUnauthorized: false });

        const response = await axios.get(urlToCheck, {
            timeout: 10000,
            maxRedirects: 5,
            httpsAgent: agent,
            validateStatus: (status) => status < 500,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
            }
        });

        // Treat 401/403 as healthy (site is up but protected)
        const isHealthy = (response.status >= 200 && response.status < 400) || response.status === 401 || response.status === 403;

        return {
            isHealthy,
            statusCode: response.status,
            responseTime: Date.now() - startTime,
            lastChecked: new Date().toISOString()
        };
    } catch (error) {
        let errorMessage = error.message || '无法访问';
        if (error.code === 'ECONNABORTED') {
            errorMessage = '请求超时';
        } else if (error.response) {
            errorMessage = `服务器错误: ${error.response.status}`;
        }

        return {
            isHealthy: false,
            statusCode: error.response?.status,
            errorMessage,
            responseTime: Date.now() - startTime,
            lastChecked: new Date().toISOString()
        };
    }
}

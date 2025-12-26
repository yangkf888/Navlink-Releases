// kbrag 知识库保存逻辑
let settings = {};
let kbragData = {};

// 安全的 URI 解码函数
function safeDecodeURIComponent(str) {
    if (!str) return '';
    try {
        return decodeURIComponent(str);
    } catch (e) {
        // 如果解码失败，尝试替换常见的编码问题
        try {
            // 替换可能的问题字符后再尝试
            return decodeURIComponent(str.replace(/%(?![0-9A-Fa-f]{2})/g, '%25'));
        } catch (e2) {
            // 如果还是失败，返回原字符串
            console.warn('Failed to decode URI component:', str);
            return str;
        }
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 从 URL 参数获取内容信息
        const params = new URLSearchParams(window.location.search);
        kbragData = {
            title: safeDecodeURIComponent(params.get('title') || ''),
            content: safeDecodeURIComponent(params.get('content') || ''),
            url: safeDecodeURIComponent(params.get('url') || '')
        };

        // 获取设置
        settings = await chrome.storage.sync.get(['serverUrl', 'authToken']);

        if (!settings.authToken) {
            alert('请先在设置页面登录 NavLink');
            window.close();
            return;
        }

        // 显示预览
        displayPreview();

        // 加载分类列表
        await loadCategories();

        // 绑定事件
        bindEvents();

    } catch (error) {
        console.error('Initialization error:', error);
        alert('初始化失败: ' + error.message);
        window.close();
    }
});

// 显示预览
function displayPreview() {
    document.getElementById('titlePreview').textContent = kbragData.title || '(无标题)';
    document.getElementById('contentPreview').textContent =
        kbragData.content?.substring(0, 200) + (kbragData.content?.length > 200 ? '...' : '') || '(无内容)';
    document.getElementById('title').value = kbragData.title;
}

// 加载分类列表
async function loadCategories() {
    try {
        const baseUrl = settings.serverUrl || 'http://localhost:3001';
        const response = await fetch(`${baseUrl}/api/plugins/kbrag/api/categories`, {
            headers: {
                'Authorization': `Bearer ${settings.authToken}`
            }
        });

        if (!response.ok) {
            console.warn('Failed to load kbrag categories');
            return;
        }

        const result = await response.json();
        const categories = result.success ? result.data : result;

        const categorySelect = document.getElementById('category');
        categorySelect.innerHTML = '<option value="">未分类</option>';

        if (Array.isArray(categories)) {
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.name || cat.id;
                option.textContent = cat.name;
                categorySelect.appendChild(option);
            });
        }

        // 尝试恢复上次选择的分类
        const lastCategory = await chrome.storage.local.get(['kbragLastCategory']);
        if (lastCategory.kbragLastCategory) {
            categorySelect.value = lastCategory.kbragLastCategory;
        }

    } catch (error) {
        console.error('Load categories error:', error);
    }
}

// 绑定事件
function bindEvents() {
    // 取消按钮
    document.getElementById('cancelBtn').addEventListener('click', () => {
        window.close();
    });

    // 表单提交
    document.getElementById('kbragForm').addEventListener('submit', handleSubmit);
}

// 表单提交处理
async function handleSubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const loadingOverlay = document.getElementById('loading');

    try {
        // 显示加载状态
        submitBtn.disabled = true;
        loadingOverlay.style.display = 'flex';

        // 获取表单数据
        const title = document.getElementById('title').value.trim();
        const category = document.getElementById('category').value;
        const tagsInput = document.getElementById('tags').value.trim();
        const note = document.getElementById('note').value.trim();

        if (!title) {
            alert('请输入标题');
            submitBtn.disabled = false;
            loadingOverlay.style.display = 'none';
            return;
        }

        // 解析标签
        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

        // 保存上次选择的分类
        await chrome.storage.local.set({ kbragLastCategory: category });

        // 调用 API 保存
        const baseUrl = settings.serverUrl || 'http://localhost:3001';
        const response = await fetch(`${baseUrl}/api/plugins/kbrag/api/items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.authToken}`
            },
            body: JSON.stringify({
                title,
                content: kbragData.content,
                url: kbragData.url,
                category,
                tags,
                note
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `保存失败 (${response.status})`);
        }

        // 显示成功通知
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '../icons/icon48.png',
            title: '保存成功',
            message: `已保存到知识库${category ? ` [${category}]` : ''}`
        });

        // 关闭窗口
        setTimeout(() => {
            window.close();
        }, 500);

    } catch (error) {
        console.error('Submit error:', error);
        alert('保存失败: ' + error.message);
        submitBtn.disabled = false;
        loadingOverlay.style.display = 'none';
    }
}

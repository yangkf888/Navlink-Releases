// NavLink Helper - Background Service Worker
// 处理右键菜单、快捷键等后台事件

// 插件安装时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  console.log('NavLink Helper installed');

  // 创建右键菜单项 - 添加链接
  chrome.contextMenus.create({
    id: 'addToNavLink',
    title: '添加到 NavLink',
    contexts: ['page', 'link', 'selection']
  });

  // 创建子菜单 - 快速添加到最近使用的分类
  chrome.contextMenus.create({
    id: 'addToRecentCategory',
    parentId: 'addToNavLink',
    title: '添加到最近分类',
    contexts: ['page', 'link']
  });

  chrome.contextMenus.create({
    id: 'addWithDialog',
    parentId: 'addToNavLink',
    title: '选择分类添加...',
    contexts: ['page', 'link']
  });

  // ========== 知识库相关菜单 ==========
  chrome.contextMenus.create({
    id: 'separator1',
    type: 'separator',
    contexts: ['page', 'selection']
  });

  // 保存选中文本到知识库
  chrome.contextMenus.create({
    id: 'saveToKnowledgeBase',
    title: '保存到知识库',
    contexts: ['selection']
  });

  // 保存整页到知识库
  chrome.contextMenus.create({
    id: 'savePageToKnowledgeBase',
    title: '保存整页到知识库',
    contexts: ['page']
  });
});

// 右键菜单点击事件
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'addWithDialog') {
    await handleAddLink(info, tab, false);
  } else if (info.menuItemId === 'addToRecentCategory') {
    await handleAddLink(info, tab, true);
  } else if (info.menuItemId === 'saveToKnowledgeBase') {
    // 保存选中文本到知识库
    await handleSaveToKnowledgeBase(info, tab, 'selection');
  } else if (info.menuItemId === 'savePageToKnowledgeBase') {
    // 保存整页到知识库
    await handleSaveToKnowledgeBase(info, tab, 'page');
  }
});

// 快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'add-current-page') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const info = { pageUrl: tab.url };
    await handleAddLink(info, tab, false);
  }
});

// 处理添加链接逻辑
async function handleAddLink(info, tab, useRecentCategory) {
  try {
    // 获取链接信息
    const url = info.linkUrl || info.pageUrl || tab.url;
    const title = info.selectionText || tab.title || '';

    // 获取 favicon
    const faviconUrl = await getFaviconUrl(url, tab);

    // 检查是否已登录
    const settings = await chrome.storage.sync.get(['serverUrl', 'authToken']);

    if (!settings.authToken) {
      // 未登录，打开设置页面
      chrome.runtime.openOptionsPage();
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'NavLink Helper',
        message: '请先在设置页面登录 NavLink'
      });
      return;
    }

    if (useRecentCategory) {
      // 直接添加到最近使用的分类
      const result = await addToRecentCategory(url, title, faviconUrl, settings);
      showNotification(result.success, result.message);
    } else {
      // 打开选择对话框
      const width = 420;
      const height = 650;

      // Service Worker 中无法访问 screen 对象，使用固定位置或不设置让浏览器自动定位
      chrome.windows.create({
        url: `popup/add.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&icon=${encodeURIComponent(faviconUrl)}`,
        type: 'popup',
        width: width,
        height: height,
        left: 100,
        top: 100
      });
    }
  } catch (error) {
    console.error('Add link error:', error);
    showNotification(false, '添加失败: ' + error.message);
  }
}

// 获取网站图标
async function getFaviconUrl(url, tab) {
  try {
    const domain = new URL(url).hostname;

    // 方案1: 尝试从标签页获取 favIconUrl
    if (tab && tab.favIconUrl && !tab.favIconUrl.includes('chrome://')) {
      return tab.favIconUrl;
    }

    // 方案2: 使用 Google Favicon 服务
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch (error) {
    console.error('Get favicon error:', error);
    return '';
  }
}

// 添加到最近使用的分类
async function addToRecentCategory(url, title, faviconUrl, settings) {
  try {
    const recentCategory = await chrome.storage.local.get('recentCategory');

    if (!recentCategory.recentCategory) {
      return {
        success: false,
        message: '未找到最近使用的分类，请先手动添加一次'
      };
    }

    // 调用 API 添加链接
    const api = new NavLinkAPI(settings.serverUrl, settings.authToken);
    await api.addLink(
      recentCategory.recentCategory.categoryId,
      recentCategory.recentCategory.subCategoryId,
      {
        title: title,
        url: url,
        icon: faviconUrl,
        description: ''
      }
    );

    return {
      success: true,
      message: `已添加到「${recentCategory.recentCategory.categoryName}」`
    };
  } catch (error) {
    return {
      success: false,
      message: '添加失败: ' + error.message
    };
  }
}

// 显示通知
function showNotification(success, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: success ? '添加成功' : '添加失败',
    message: message
  });
}

// 简单的 API 封装类（在 background 中使用）
class NavLinkAPI {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl || 'http://localhost:3001';
    this.token = token || '';
  }

  async addLink(categoryId, subCategoryId, linkData) {
    // 1. 获取当前配置
    const response = await fetch(`${this.baseUrl}/api/config`);
    if (!response.ok) throw new Error('获取配置失败');
    const config = await response.json();

    // 2. 找到目标分类
    const category = config.categories.find(c => c.id === categoryId);
    if (!category) throw new Error('分类不存在');

    const newLink = {
      id: Date.now().toString(),
      ...linkData
    };

    if (subCategoryId) {
      // 添加到子分类
      const subCategory = category.subCategories?.find(s => s.id === subCategoryId);
      if (!subCategory) throw new Error('子分类不存在');
      subCategory.items = subCategory.items || [];
      subCategory.items.push(newLink);
    } else {
      // 添加到主分类
      category.items = category.items || [];
      category.items.push(newLink);
    }

    // 3. 保存配置
    const saveResponse = await fetch(`${this.baseUrl}/api/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(config)
    });

    if (!saveResponse.ok) {
      const error = await saveResponse.json();
      throw new Error(error.error || '保存失败');
    }

    return await saveResponse.json();
  }
}

// ========== 知识库功能 ==========

// 处理保存到知识库
async function handleSaveToKnowledgeBase(info, tab, type) {
  try {
    // 检查是否已登录
    const settings = await chrome.storage.sync.get(['serverUrl', 'authToken']);

    if (!settings.authToken) {
      chrome.runtime.openOptionsPage();
      showNotification(false, '请先在设置页面登录 NavLink');
      return;
    }

    let content, title;

    if (type === 'selection') {
      // 保存选中文本
      content = info.selectionText;
      title = `${tab.title} - 选段`;
    } else {
      // 保存整页内容 - 需要注入脚本获取页面主体内容
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // 尝试提取页面主体内容
            // 1. 优先使用 article 标签
            const article = document.querySelector('article');
            if (article) {
              return article.innerText.substring(0, 50000);
            }

            // 2. 尝试 main 标签
            const main = document.querySelector('main');
            if (main) {
              return main.innerText.substring(0, 50000);
            }

            // 3. 尝试常见的内容容器
            const contentSelectors = [
              '.article-content', '.post-content', '.entry-content',
              '.content', '.main-content', '#content', '#main',
              '[role="main"]', '.markdown-body', '.prose'
            ];

            for (const selector of contentSelectors) {
              const element = document.querySelector(selector);
              if (element && element.innerText.length > 200) {
                return element.innerText.substring(0, 50000);
              }
            }

            // 4. 回退：获取 body 内容，但过滤掉常见的非正文元素
            const body = document.body.cloneNode(true);
            const removeSelectors = [
              'header', 'footer', 'nav', 'aside', 'script', 'style', 'noscript',
              '.sidebar', '.navigation', '.menu', '.ad', '.advertisement',
              '#header', '#footer', '#sidebar', '#nav', '#menu',
              '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]'
            ];

            removeSelectors.forEach(selector => {
              body.querySelectorAll(selector).forEach(el => el.remove());
            });

            return body.innerText.substring(0, 50000);
          }
        });
        content = results[0]?.result || '';
        title = tab.title;
      } catch (e) {
        console.error('Failed to get page content:', e);
        showNotification(false, '无法获取页面内容，请检查页面权限');
        return;
      }
    }

    if (!content || content.trim().length < 10) {
      showNotification(false, '内容太短，无法保存');
      return;
    }

    // 打开分类选择弹窗
    const params = new URLSearchParams({
      title: title,
      content: content.trim().substring(0, 10000), // URL 长度限制，截取前10000字符
      url: tab.url
    });

    chrome.windows.create({
      url: `popup/kbrag.html?${params.toString()}`,
      type: 'popup',
      width: 450,
      height: 550,
      top: 100,
      left: 100
    });

  } catch (error) {
    console.error('Save to knowledge base error:', error);
    showNotification(false, '保存失败: ' + error.message);
  }
}

// 知识库 API 封装类
class KnowledgeBaseAPI {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl || 'http://localhost:3001';
    this.token = token || '';
  }

  async saveKnowledge(data) {
    const response = await fetch(`${this.baseUrl}/api/plugins/kbrag/api/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `保存失败 (${response.status})`);
    }

    return await response.json();
  }
}

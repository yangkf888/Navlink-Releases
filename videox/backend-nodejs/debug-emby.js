const axios = require('axios');

async function debugEmby() {
    const url = 'http://192.168.1.100:8096'; // 用户添加的 URL
    const api_key = '...'; // 用户添加的 KEY

    try {
        // 1. 获取用户
        const users = await axios.get(`${url}/emby/Users`, { headers: { 'X-Emby-Token': api_key } });
        const userId = users.data[0].Id;
        console.log('UserId:', userId);

        // 2. 获取分类
        const views = await axios.get(`${url}/emby/Users/${userId}/Views`, { headers: { 'X-Emby-Token': api_key } });
        console.log('Views:', views.data.Items.map(v => ({ Name: v.Name, Id: v.Id, CollectionType: v.CollectionType })));

        // 3. 测试获取具体分类下的 Item
        const parentId = views.data.Items[0].Id; // 取第一个分类
        console.log('Testing ParentId:', parentId);

        const items = await axios.get(`${url}/emby/Users/${userId}/Items`, {
            params: {
                ParentId: parentId,
                Recursive: true,
                Fields: 'PrimaryImageAspectRatio',
                StartIndex: 0,
                Limit: 10
            },
            headers: { 'X-Emby-Token': api_key }
        });
        console.log('Items Count:', items.data.Items.length);
    } catch (e) {
        console.error('Debug Error:', e.response?.status, e.response?.data || e.message);
    }
}

// debugEmby();

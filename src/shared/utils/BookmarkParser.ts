import { Category, LinkItem } from '../types';

/**
 * 解析 Chrome 导出的 HTML 书签文件
 * Chrome 书签使用的是一种非标准的 Netscape 格式
 */
export class BookmarkParser {
    private parser: DOMParser;

    constructor() {
        this.parser = new DOMParser();
    }

    /**
     * 将 HTML 字符串解析为 Navlink 分类数组
     */
    public parse(html: string): Category[] {
        const doc = this.parser.parseFromString(html, 'text/html');
        const rootDl = doc.querySelector('dl');
        if (!rootDl) return [];

        const categories: Category[] = [];

        // 我们主要寻找一级文件夹作为主分类
        const topLevelFolders = rootDl.querySelectorAll(':scope > dt > h3');

        // 如果没有文件夹，就把外面所有链接归纳到一个默认分类
        const topLevelLinks = rootDl.querySelectorAll(':scope > dt > a');

        if (topLevelLinks.length > 0) {
            categories.push(this.createCategoryFromLinks('已导入书签', Array.from(topLevelLinks)));
        }

        topLevelFolders.forEach(h3 => {
            const folderName = h3.textContent || '未命名分类';
            const dl = h3.nextElementSibling; // 通常 H3 后面跟着 DL

            if (dl && dl.tagName === 'DL') {
                const result = this.traverseFolder(dl);
                if (result.items.length > 0 || (result.subCategories && result.subCategories.length > 0)) {
                    categories.push({
                        id: 'import_' + Date.now() + Math.random().toString(36).substr(2, 9),
                        name: folderName,
                        icon: 'fa-solid fa-folder',
                        items: result.items,
                        subCategories: result.subCategories.length > 0 ? result.subCategories : undefined
                    });
                }
            }
        });

        return categories;
    }

    /**
     * 递归遍历文件夹结构
     * 将深层级文件夹映射为子分类 (Tab)
     */
    private traverseFolder(dl: Element): { items: LinkItem[], subCategories: any[] } {
        const items: LinkItem[] = [];
        const subCategories: any[] = [];

        const dts = dl.querySelectorAll(':scope > dt');

        dts.forEach(dt => {
            const h3 = dt.querySelector('h3');
            const a = dt.querySelector('a');

            if (a) {
                // 这是一个链接
                items.push({
                    id: 'item_' + Date.now() + Math.random().toString(36).substr(2, 9),
                    title: a.textContent || '无标题',
                    url: a.getAttribute('href') || '#',
                    icon: a.getAttribute('icon') || '', // 解析 Base64 图标
                    description: '',
                    color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0') // 随机颜色
                });
            } else if (h3) {
                // 这是一个文件夹
                const subDl = dt.querySelector('dl');
                if (subDl) {
                    const result = this.traverseFolder(subDl);
                    // 如果有内容，将其转为子分类
                    subCategories.push({
                        name: h3.textContent || '子分类',
                        items: [...result.items, ...result.subCategories.flatMap(s => s.items)] // 打平深度
                    });
                }
            }
        });

        return { items, subCategories };
    }

    private createCategoryFromLinks(name: string, links: Element[]): Category {
        return {
            id: 'import_' + Date.now(),
            name: name,
            icon: 'fa-solid fa-bookmark',
            items: links.map(a => ({
                id: 'item_' + Date.now() + Math.random().toString(36).substr(2, 9),
                title: a.textContent || '无标题',
                url: a.getAttribute('href') || '#',
                icon: '',
                description: '',
            }))
        };
    }
}

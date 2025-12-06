/**
 * Ensures that a URL has a protocol (http:// or https://).
 * If the URL is missing a protocol and looks like a domain, it prepends http://.
 * Internal links (starting with / or #) are left unchanged.
 * 
 * @param url The URL to check
 * @returns The URL with a protocol if needed
 */
export const ensureProtocol = (url: string | undefined): string => {
    if (!url) return '#';

    const trimmedUrl = url.trim();

    // Return empty/hash as is
    if (!trimmedUrl || trimmedUrl === '#') return '#';

    // Return internal links as is
    if (trimmedUrl.startsWith('/') || trimmedUrl.startsWith('#')) return trimmedUrl;

    // Return mailto, tel, etc as is
    if (trimmedUrl.match(/^[a-z]+:/)) return trimmedUrl;

    // If it doesn't start with http:// or https://, prepend http://
    // We assume it's a domain name if it doesn't match the above
    return `http://${trimmedUrl}`;
};

/**
 * Remove an item from an array by index
 * @param arr The array
 * @param index The index to remove
 * @returns A new array without the item at the specified index
 */
export function removeItem<T>(arr: T[], index: number): T[] {
    return arr.filter((_, i) => i !== index);
}

/**
 * 统一的切换按钮样式工具函数
 * 用于后台管理界面中需要选中/未选中状态的按钮
 * 
 * 设计规范：
 * - 选中状态：红底白字 + 阴影 + hover加深
 * - 未选中状态：灰色文字 + hover背景 + hover文字变深
 * - 所有状态都有 active 按压反馈
 * 
 * @param isSelected 是否选中
 * @param baseClass 基础样式类名
 * @returns 完整的 className 字符串
 */
export const toggleButtonClass = (
    isSelected: boolean, 
    baseClass: string = 'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200'
): string => {
    const selectedStyles = 'bg-red-500 text-white shadow-sm hover:bg-red-600 active:bg-red-700';
    const unselectedStyles = 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200';
    
    return `${baseClass} ${isSelected ? selectedStyles : unselectedStyles}`;
};

/**
 * 计算颜色的亮度并返回合适的对比色（黑色或白色）
 * @param hex 十六进制颜色值 (例如 #FFFFFF 或 #000)
 * @returns '#000000' 或 '#ffffff'
 */
export const getContrastColor = (hex: string | undefined): string => {
    if (!hex) return '#000000'; // 默认返回黑色

    // 移除 # 号
    let color = hex.replace('#', '');

    // 处理 3 位扩展为 6 位
    if (color.length === 3) {
        color = color.split('').map(c => c + c).join('');
    }

    // 转换为 RGB
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);

    // 计算亮度 (Luminance)
    // 公式: 0.299*R + 0.587*G + 0.114*B
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b);

    // 如果亮度 > 128，说明背景是浅色，返回黑色文字；否则返回白色文字
    return luminance > 128 ? '#000000' : '#ffffff';
};

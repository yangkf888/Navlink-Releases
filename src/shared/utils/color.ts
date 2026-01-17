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

    // 转换为 RGB 并归一化到 [0, 1]
    const r = parseInt(color.substring(0, 2), 16) / 255;
    const g = parseInt(color.substring(2, 4), 16) / 255;
    const b = parseInt(color.substring(4, 6), 16) / 255;

    // W3C 相对亮度公式 (Relative Luminance)
    // 线性化分量
    const linearize = (c: number) => {
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };

    const L = 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);

    // 相对亮度 > 0.5 时返回黑色文字；否则返回白色文字
    return L > 0.5 ? '#000000' : '#ffffff';
};

import type { SiteConfig } from './types';
// @ts-expect-error - IDE may not follow the .js to .d.ts mapping in some configurations
import { DEFAULT_CONFIG as SHARED_DEFAULT_CONFIG } from '../../server/config/default-config.js';

// 将共享的 JS 配置导出为 SiteConfig 类型
export const DEFAULT_CONFIG = SHARED_DEFAULT_CONFIG as SiteConfig;
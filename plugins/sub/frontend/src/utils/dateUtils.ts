/**
 * 日期计算工具函数
 */

import { Subscription, SubscriptionStatus } from '../types/subscription';

/**
 * 计算剩余天数
 */
export function calculateDaysRemaining(expiryDate: string): number {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * 获取订阅状态
 */
export function getSubscriptionStatus(subscription: Subscription): SubscriptionStatus {
  if (!subscription.isActive) return 'expired';

  const daysRemaining = calculateDaysRemaining(subscription.expiryDate);

  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= 3) return 'urgent';
  if (daysRemaining <= 7) return 'warning';
  return 'active';
}

/**
 * 格式化日期显示
 */
export function formatDate(dateString: string, format: 'full' | 'short' = 'full'): string {
  const date = new Date(dateString);

  if (format === 'short') {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * 计算下一个周期的到期日期
 */
export function calculateNextPeriod(subscription: Subscription): string {
  const { expiryDate, periodValue, periodUnit } = subscription;
  const date = new Date(expiryDate);

  switch (periodUnit) {
    case 'day':
      date.setDate(date.getDate() + periodValue);
      break;
    case 'month':
      date.setMonth(date.getMonth() + periodValue);
      break;
    case 'year':
      date.setFullYear(date.getFullYear() + periodValue);
      break;
  }

  return date.toISOString().split('T')[0];
}

/**
 * 获取今天的日期（YYYY-MM-DD格式）
 */
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * 获取本地日期字符串(YYYY-MM-DD格式)
 * 避免使用 toISOString 导致的时区转换问题
 * @param date - 日期对象
 * @param timezone - 时区（如 'Asia/Shanghai', 'UTC'），默认使用浏览器本地时区
 */
export function getLocalDateString(date: Date, timezone?: string): string {
  if (timezone) {
    // 使用指定时区
    const dateStr = date.toLocaleDateString('en-CA', { timeZone: timezone });
    return dateStr; // en-CA 格式是 YYYY-MM-DD
  } else {
    // 使用浏览器本地时区
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * 获取当前本地时间(HH:mm格式)
 * @param timezone - 时区（如 'Asia/Shanghai', 'UTC'），默认使用浏览器本地时区
 */
export function getCurrentTimeString(timezone?: string): string {
  const now = new Date();
  if (timezone) {
    // 使用指定时区
    const timeStr = now.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    return timeStr;
  } else {
    // 使用浏览器本地时区
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

/**
 * 验证日期格式
 */
export function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

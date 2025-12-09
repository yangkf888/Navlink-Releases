import { describe, it, expect } from 'vitest';
import { ensureProtocol, removeItem, toggleButtonClass } from './url';

describe('ensureProtocol', () => {
    it('returns "#" for empty or undefined url', () => {
        expect(ensureProtocol('')).toBe('#');
        expect(ensureProtocol(undefined)).toBe('#');
        expect(ensureProtocol('#')).toBe('#');
    });

    it('preserves http/https protocols', () => {
        expect(ensureProtocol('https://example.com')).toBe('https://example.com');
        expect(ensureProtocol('http://example.com')).toBe('http://example.com');
    });

    it('adds http:// to domain-like urls', () => {
        expect(ensureProtocol('example.com')).toBe('http://example.com');
        expect(ensureProtocol('www.google.com')).toBe('http://www.google.com');
    });

    it('preserves internal links', () => {
        expect(ensureProtocol('/dashboard')).toBe('/dashboard');
        expect(ensureProtocol('#section')).toBe('#section');
    });

    it('preserves mailto and tel links', () => {
        expect(ensureProtocol('mailto:test@example.com')).toBe('mailto:test@example.com');
        expect(ensureProtocol('tel:1234567890')).toBe('tel:1234567890');
    });
});

describe('removeItem', () => {
    it('removes item at index', () => {
        const arr = [1, 2, 3];
        expect(removeItem(arr, 1)).toEqual([1, 3]);
    });

    it('returns original array if index out of bounds', () => {
        const arr = [1, 2];
        expect(removeItem(arr, 5)).toEqual([1, 2]);
    });
});

describe('toggleButtonClass', () => {
    it('returns selected class when true', () => {
        const cls = toggleButtonClass(true);
        expect(cls).toContain('bg-red-500');
        expect(cls).toContain('text-white');
    });

    it('returns unselected class when false', () => {
        const cls = toggleButtonClass(false);
        expect(cls).toContain('text-gray-600');
        expect(cls).toContain('hover:bg-gray-100');
    });

    it('appends to base class', () => {
        const base = 'custom-base';
        const cls = toggleButtonClass(false, base);
        expect(cls).toContain('custom-base');
    });
});

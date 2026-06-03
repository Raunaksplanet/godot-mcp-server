import { describe, it, expect } from 'vitest';
import { ResponseCache } from '../src/cache.js';

describe('ResponseCache', () => {
  it('should store and retrieve values', () => {
    const cache = new ResponseCache(5000);
    cache.set('get_scene_tree', {}, { nodes: [] });
    const result = cache.get('get_scene_tree', {});
    expect(result).toEqual({ nodes: [] });
  });

  it('should return null for missing keys', () => {
    const cache = new ResponseCache(5000);
    const result = cache.get('nonexistent', {});
    expect(result).toBeNull();
  });

  it('should expire entries after TTL', async () => {
    const cache = new ResponseCache(10);
    cache.set('ping', {}, { status: 'ok' });
    await new Promise((r) => setTimeout(r, 20));
    const result = cache.get('ping', {});
    expect(result).toBeNull();
  });

  it('should invalidate by method name', () => {
    const cache = new ResponseCache(5000);
    cache.set('ping', {}, { status: 'ok' });
    cache.set('get_project_info', {}, { name: 'test' });
    cache.invalidate('ping');
    expect(cache.get('ping', {})).toBeNull();
    expect(cache.get('get_project_info', {})).toEqual({ name: 'test' });
  });

  it('should clear all entries', () => {
    const cache = new ResponseCache(5000);
    cache.set('ping', {}, { status: 'ok' });
    cache.set('get_scene_tree', {}, { nodes: [] });
    cache.invalidateAll();
    expect(cache.size).toBe(0);
  });
});

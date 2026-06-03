interface CacheEntry {
  data: Record<string, unknown>;
  expiresAt: number;
}

export class ResponseCache {
  private cache = new Map<string, CacheEntry>();
  private defaultTTL: number;

  constructor(defaultTTLMs = 2000) {
    this.defaultTTL = defaultTTLMs;
  }

  private buildKey(method: string, params: Record<string, unknown>): string {
    return `${method}:${JSON.stringify(params)}`;
  }

  get(method: string, params: Record<string, unknown>): Record<string, unknown> | null {
    const key = this.buildKey(method, params);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(
    method: string,
    params: Record<string, unknown>,
    data: Record<string, unknown>,
    ttlMs?: number
  ): void {
    const key = this.buildKey(method, params);
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTTL),
    });
  }

  invalidate(method?: string): void {
    if (!method) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${method}:`)) {
        this.cache.delete(key);
      }
    }
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

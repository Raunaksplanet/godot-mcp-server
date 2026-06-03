export class ResponseCache {
    cache = new Map();
    defaultTTL;
    constructor(defaultTTLMs = 2000) {
        this.defaultTTL = defaultTTLMs;
    }
    buildKey(method, params) {
        return `${method}:${JSON.stringify(params)}`;
    }
    get(method, params) {
        const key = this.buildKey(method, params);
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    set(method, params, data, ttlMs) {
        const key = this.buildKey(method, params);
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + (ttlMs ?? this.defaultTTL),
        });
    }
    invalidate(method) {
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
    invalidateAll() {
        this.cache.clear();
    }
    get size() {
        return this.cache.size;
    }
}
//# sourceMappingURL=cache.js.map
export declare class ResponseCache {
    private cache;
    private defaultTTL;
    constructor(defaultTTLMs?: number);
    private buildKey;
    get(method: string, params: Record<string, unknown>): Record<string, unknown> | null;
    set(method: string, params: Record<string, unknown>, data: Record<string, unknown>, ttlMs?: number): void;
    invalidate(method?: string): void;
    invalidateAll(): void;
    get size(): number;
}
//# sourceMappingURL=cache.d.ts.map
export declare class RequestQueue {
    private queue;
    private processing;
    private maxConcurrent;
    private activeCount;
    private processor;
    constructor(processor: (method: string, params: Record<string, unknown>) => Promise<Record<string, unknown>>, maxConcurrent?: number);
    enqueue(method: string, params: Record<string, unknown>, priority?: number): Promise<Record<string, unknown>>;
    get pendingCount(): number;
    clear(): void;
    private processNext;
}
//# sourceMappingURL=queue.d.ts.map
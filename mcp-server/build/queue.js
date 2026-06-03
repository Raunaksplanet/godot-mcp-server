export class RequestQueue {
    queue = [];
    processing = false;
    maxConcurrent;
    activeCount = 0;
    processor;
    constructor(processor, maxConcurrent = 3) {
        this.processor = processor;
        this.maxConcurrent = maxConcurrent;
    }
    enqueue(method, params, priority = 0) {
        return new Promise((resolve, reject) => {
            this.queue.push({ method, params, resolve, reject, priority, timestamp: Date.now() });
            this.queue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);
            this.processNext();
        });
    }
    get pendingCount() {
        return this.queue.length;
    }
    clear() {
        for (const entry of this.queue) {
            entry.reject(new Error('Queue cleared'));
        }
        this.queue = [];
        this.activeCount = 0;
    }
    processNext() {
        if (this.processing || this.activeCount >= this.maxConcurrent)
            return;
        if (this.queue.length === 0)
            return;
        this.activeCount++;
        const entry = this.queue.shift();
        this.processor(entry.method, entry.params)
            .then(entry.resolve)
            .catch(entry.reject)
            .finally(() => {
            this.activeCount--;
            this.processNext();
        });
        if (this.activeCount < this.maxConcurrent) {
            setImmediate(() => this.processNext());
        }
    }
}
//# sourceMappingURL=queue.js.map
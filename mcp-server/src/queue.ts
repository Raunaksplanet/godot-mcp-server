interface QueueEntry {
  method: string;
  params: Record<string, unknown>;
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  priority: number;
  timestamp: number;
}

export class RequestQueue {
  private queue: QueueEntry[] = [];
  private processing = false;
  private maxConcurrent: number;
  private activeCount = 0;
  private processor: (method: string, params: Record<string, unknown>) => Promise<Record<string, unknown>>;

  constructor(
    processor: (method: string, params: Record<string, unknown>) => Promise<Record<string, unknown>>,
    maxConcurrent = 3
  ) {
    this.processor = processor;
    this.maxConcurrent = maxConcurrent;
  }

  enqueue(
    method: string,
    params: Record<string, unknown>,
    priority = 0
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      this.queue.push({ method, params, resolve, reject, priority, timestamp: Date.now() });
      this.queue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);
      this.processNext();
    });
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  clear(): void {
    for (const entry of this.queue) {
      entry.reject(new Error('Queue cleared'));
    }
    this.queue = [];
    this.activeCount = 0;
  }

  private processNext(): void {
    if (this.processing || this.activeCount >= this.maxConcurrent) return;
    if (this.queue.length === 0) return;

    this.activeCount++;
    const entry = this.queue.shift()!;

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

import { HealthStatus } from './types.js';
export declare class GodotBridge {
    private ws;
    private pending;
    private msgCounter;
    private url;
    private reconnectTimer;
    private healthCheckTimer;
    private _connected;
    private reconnecting;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private startTime;
    private lastConnectedTime;
    private lastDisconnectedTime;
    private _godotVersion;
    private logger;
    private queue;
    private cache;
    onConnected?: () => void;
    onDisconnected?: () => void;
    constructor(host?: string, port?: number, maxReconnectAttempts?: number);
    get connected(): boolean;
    get status(): HealthStatus;
    get cacheSize(): number;
    invalidateCache(method?: string): void;
    connect(): Promise<void>;
    call(method: string, params?: Record<string, unknown>, options?: {
        priority?: number;
        skipCache?: boolean;
        timeout?: number;
    }): Promise<Record<string, unknown>>;
    private verifyConnection;
    private sendRaw;
    ping(): Promise<Record<string, unknown>>;
    disconnect(): void;
    private scheduleReconnect;
    private startHealthChecks;
    private stopHealthChecks;
}
//# sourceMappingURL=godot-bridge.d.ts.map
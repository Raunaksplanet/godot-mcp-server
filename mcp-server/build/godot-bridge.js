import WebSocket from 'ws';
import { Logger } from './logger.js';
import { RequestQueue } from './queue.js';
import { ResponseCache } from './cache.js';
const DEFAULT_TIMEOUT = 30_000;
const RECONNECT_INTERVAL = 3000;
const HEALTH_CHECK_INTERVAL = 5_000;
const CACHE_TTL_READ = 500;
export class GodotBridge {
    ws = null;
    pending = new Map();
    msgCounter = 0;
    url;
    reconnectTimer = null;
    healthCheckTimer = null;
    _connected = false;
    reconnecting = false;
    reconnectAttempts = 0;
    maxReconnectAttempts;
    startTime = null;
    lastConnectedTime = null;
    lastDisconnectedTime = null;
    _godotVersion = null;
    logger;
    queue;
    cache;
    onConnected;
    onDisconnected;
    constructor(host = 'localhost', port = 9080, maxReconnectAttempts = 0) {
        this.url = `ws://${host}:${port}`;
        this.maxReconnectAttempts = maxReconnectAttempts;
        this.logger = new Logger('GodotBridge');
        this.queue = new RequestQueue((method, params) => this.sendRaw(method, params));
        this.cache = new ResponseCache(CACHE_TTL_READ);
    }
    get connected() {
        return this._connected;
    }
    get status() {
        return {
            connected: this._connected,
            lastConnected: this.lastConnectedTime,
            lastDisconnected: this.lastDisconnectedTime,
            reconnectAttempts: this.reconnectAttempts,
            uptime: this._connected && this.startTime ? Date.now() - this.startTime : null,
            pendingRequests: this.pending.size + this.queue.pendingCount,
            godotVersion: this._godotVersion ?? undefined,
        };
    }
    get cacheSize() {
        return this.cache.size;
    }
    invalidateCache(method) {
        if (method) {
            this.cache.invalidate(method);
        }
        else {
            this.cache.invalidateAll();
        }
    }
    async connect() {
        if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
            return;
        }
        return new Promise((resolve, reject) => {
            this.logger.info('Connecting to Godot', { url: this.url });
            this.ws = new WebSocket(this.url);
            const connectTimeout = setTimeout(() => {
                this.ws?.close();
                reject(new Error(`Connection timeout: could not reach ${this.url}`));
            }, 5000);
            this.ws.onopen = () => {
                clearTimeout(connectTimeout);
                this._connected = true;
                this.reconnecting = false;
                this.reconnectAttempts = 0;
                this.startTime = Date.now();
                this.lastConnectedTime = new Date().toISOString();
                this.logger.info('Connected to Godot editor');
                this.startHealthChecks();
                this.onConnected?.();
                resolve();
            };
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data.toString());
                    const id = data.id;
                    if (id != null && typeof id === 'number' && this.pending.has(id)) {
                        const entry = this.pending.get(id);
                        clearTimeout(entry.timer);
                        this.pending.delete(id);
                        if (data.error) {
                            entry.reject(new Error(data.message || data.error));
                        }
                        else {
                            entry.resolve(data.result ?? {});
                        }
                    }
                }
                catch (err) {
                    this.logger.warn('Malformed message received', { error: String(err) });
                }
            };
            this.ws.onclose = () => {
                clearTimeout(connectTimeout);
                const wasConnected = this._connected;
                this._connected = false;
                this.lastDisconnectedTime = new Date().toISOString();
                for (const [id, entry] of this.pending) {
                    clearTimeout(entry.timer);
                    entry.reject(new Error('Connection closed'));
                }
                this.pending.clear();
                if (wasConnected) {
                    this.logger.warn('Disconnected from Godot editor');
                    this.onDisconnected?.();
                }
                this.stopHealthChecks();
                this.scheduleReconnect();
            };
            this.ws.onerror = () => {
                clearTimeout(connectTimeout);
                if (!this._connected) {
                    reject(new Error(`WebSocket connection failed: ${this.url}`));
                }
            };
        });
    }
    async call(method, params = {}, options = {}) {
        const readOnlyMethods = new Set([
            'ping',
            'get_project_info',
            'get_scene_tree',
            'get_property',
            'list_files',
            'read_file',
            'get_project_settings',
            'get_signal_list',
            'get_export_presets',
            'get_plugins',
            'validate_script',
            'get_asset_import_options',
        ]);
        if (!options.skipCache && readOnlyMethods.has(method)) {
            const cached = this.cache.get(method, params);
            if (cached) {
                this.logger.debug('Cache hit', { method });
                return cached;
            }
        }
        if (method !== 'ping' && method !== 'get_project_info') {
            this.verifyConnection();
        }
        try {
            const result = await this.queue.enqueue(method, params, options.priority ?? 0);
            if (!options.skipCache && readOnlyMethods.has(method)) {
                this.cache.set(method, params, result);
            }
            return result;
        }
        catch (err) {
            this.cache.invalidate(method);
            throw err;
        }
    }
    verifyConnection() {
        if (!this._connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('Not connected to Godot. Ensure the Godot MCP addon is enabled and the editor is open.');
        }
    }
    async sendRaw(method, params) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('Not connected to Godot');
        }
        const id = ++this.msgCounter;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Timeout: ${method} did not respond within 30s`));
            }, DEFAULT_TIMEOUT);
            this.pending.set(id, { resolve, reject, timer });
            const request = { id, method, params };
            this.ws.send(JSON.stringify(request));
            this.logger.debug('Sent request', { method, id });
        });
    }
    async ping() {
        try {
            const result = await this.call('ping', {}, { skipCache: true, priority: 10 });
            if (result.status === 'ok' && result.version) {
                this._godotVersion = result.version;
            }
            return result;
        }
        catch {
            return { status: 'error', message: 'Godot editor is not connected' };
        }
    }
    disconnect() {
        this.reconnecting = false;
        this.stopHealthChecks();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.ws?.close();
        this.ws = null;
        this._connected = false;
        this.logger.info('Disconnected from Godot');
    }
    scheduleReconnect() {
        if (this.reconnecting)
            return;
        if (this.maxReconnectAttempts > 0 && this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error('Max reconnect attempts reached');
            return;
        }
        this.reconnecting = true;
        this.reconnectAttempts++;
        this.logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts}`, { delay: RECONNECT_INTERVAL });
        this.reconnectTimer = setTimeout(async () => {
            if (!this.reconnecting)
                return;
            try {
                await this.connect();
            }
            catch {
                this.reconnecting = false;
                this.scheduleReconnect();
            }
        }, RECONNECT_INTERVAL);
    }
    startHealthChecks() {
        this.stopHealthChecks();
        this.healthCheckTimer = setInterval(() => {
            this.ping().catch(() => { });
        }, HEALTH_CHECK_INTERVAL);
    }
    stopHealthChecks() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
    }
}
//# sourceMappingURL=godot-bridge.js.map
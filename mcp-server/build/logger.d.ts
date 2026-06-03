import { LogLevel } from './types.js';
export declare class Logger {
    private module;
    private minLevel;
    constructor(module: string, level?: LogLevel);
    private log;
    debug(message: string, data?: Record<string, unknown>): void;
    info(message: string, data?: Record<string, unknown>): void;
    warn(message: string, data?: Record<string, unknown>): void;
    error(message: string, data?: Record<string, unknown>): void;
}
//# sourceMappingURL=logger.d.ts.map
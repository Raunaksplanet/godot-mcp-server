const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
export class Logger {
    module;
    minLevel;
    constructor(module, level = 'debug') {
        this.module = module;
        this.minLevel = LOG_LEVELS[level];
    }
    log(level, message, data) {
        if (LOG_LEVELS[level] < this.minLevel)
            return;
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            module: this.module,
            message,
            data,
        };
        const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${this.module}]`;
        const dataStr = data ? ` ${JSON.stringify(data)}` : '';
        switch (level) {
            case 'error':
                console.error(`${prefix} ${message}${dataStr}`);
                break;
            case 'warn':
                console.warn(`${prefix} ${message}${dataStr}`);
                break;
            default:
                console.error(`${prefix} ${message}${dataStr}`);
        }
    }
    debug(message, data) {
        this.log('debug', message, data);
    }
    info(message, data) {
        this.log('info', message, data);
    }
    warn(message, data) {
        this.log('warn', message, data);
    }
    error(message, data) {
        this.log('error', message, data);
    }
}
//# sourceMappingURL=logger.js.map
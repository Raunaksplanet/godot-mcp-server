export declare class SecurityManager {
    private projectRoot;
    private allowedCommands;
    constructor(projectRoot: string);
    validateFilePath(userPath: string): string;
    sanitizeShellInput(input: string): string;
    validateCommand(command: string): void;
    validateNodePath(nodePath: string): boolean;
    sanitizeNodeName(name: string): string;
}
//# sourceMappingURL=security.d.ts.map
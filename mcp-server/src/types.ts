export interface GodotResponse {
  id: string | number | null;
  result?: Record<string, unknown>;
  error?: string;
  message?: string;
}

export interface GodotRequest {
  id: number;
  method: string;
  params: Record<string, unknown>;
}

export interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnly?: boolean;
    destructive?: boolean;
    idempotent?: boolean;
  };
}

export interface ResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

export interface GodotLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  module: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface HealthStatus {
  connected: boolean;
  lastConnected: string | null;
  lastDisconnected: string | null;
  reconnectAttempts: number;
  uptime: number | null;
  pendingRequests: number;
  godotVersion?: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

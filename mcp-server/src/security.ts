import path from 'node:path';

export class SecurityManager {
  private projectRoot: string;
  private allowedCommands: Set<string>;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
    this.allowedCommands = new Set([
      'ping',
      'get_project_info',
      'create_scene',
      'load_scene',
      'save_scene',
      'get_scene_tree',
      'add_node',
      'remove_node',
      'reparent_node',
      'duplicate_node',
      'set_property',
      'get_property',
      'create_script',
      'edit_script',
      'attach_script',
      'detach_script',
      'hot_reload_scripts',
      'execute_code',
      'run_scene',
      'stop_scene',
      'list_files',
      'read_file',
      'write_file',
      'resource_load',
      'resource_save',
      'get_project_settings',
      'set_project_settings',
      'connect_signal',
      'disconnect_signal',
      'get_signal_list',
      'get_export_presets',
      'run_export',
      'get_plugins',
      'set_plugin_enabled',
      'validate_script',
      'get_asset_import_options',
      'reimport_asset',
    ]);
  }

  validateFilePath(userPath: string): string {
    if (!userPath || typeof userPath !== 'string') {
      throw new Error('File path must be a non-empty string');
    }

    let normalized: string;

    if (userPath.startsWith('res://')) {
      const relative = userPath.slice(6);
      normalized = path.resolve(this.projectRoot, relative);
    } else if (userPath.startsWith('user://')) {
      normalized = path.resolve(this.projectRoot, '.godot', userPath.slice(7));
    } else if (path.isAbsolute(userPath)) {
      normalized = path.resolve(userPath);
    } else {
      normalized = path.resolve(this.projectRoot, userPath);
    }

    if (!normalized.startsWith(this.projectRoot + path.sep) && normalized !== this.projectRoot) {
      throw new Error(`Path traversal denied: ${userPath} resolves outside project root`);
    }

    return normalized;
  }

  sanitizeShellInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }
    return input.replace(/[;&|`$(){}[\]!#~<>*?\\\n\r]/g, '').trim();
  }

  validateCommand(command: string): void {
    if (!this.allowedCommands.has(command)) {
      throw new Error(`Command '${command}' is not in the allowed allowlist`);
    }
  }

  validateNodePath(nodePath: string): boolean {
    if (!nodePath || typeof nodePath !== 'string') return false;
    if (nodePath === '.') return true;
    return /^[\w\/]+$/.test(nodePath);
  }

  sanitizeNodeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  }
}

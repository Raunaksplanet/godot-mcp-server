import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CallToolResult,
  Tool,
  Resource,
  Prompt,
} from '@modelcontextprotocol/sdk/types.js';
import { GodotBridge } from './godot-bridge.js';
import { Logger } from './logger.js';

const logger = new Logger('GodotMCP');

// ─── Tool Definitions (with annotations) ─────────────────────────────

const TOOLS: Tool[] = [
  {
    name: 'godot_ping',
    description: 'Check if Godot editor is connected and responsive. Returns version and status info.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'godot_health',
    description: 'Get detailed health information about the Godot connection including uptime, reconnect count, and pending requests.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'godot_get_project_info',
    description: 'Get comprehensive project information: name, path, main scene, current scene, rendering driver, and engine version.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'godot_create_scene',
    description: 'Create a new scene with a specified root node type.',
    inputSchema: {
      type: 'object',
      properties: {
        root_type: {
          type: 'string',
          description: 'Root node type (e.g., Node2D, Node3D, Control, Node, CharacterBody2D)',
          default: 'Node',
        },
        root_name: { type: 'string', description: 'Name for the root node', default: 'Root' },
      },
    },
  },
  {
    name: 'godot_load_scene',
    description: 'Open an existing scene file (res:// path) in the Godot editor.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Scene file path (res://...)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'godot_save_scene',
    description: 'Save the currently open scene. Provide path for new/untitled scenes.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Target path (res://...). Required for untitled scenes.' },
      },
    },
  },
  {
    name: 'godot_get_scene_tree',
    description: 'Retrieve the full hierarchical scene tree of the currently open scene, including node names, types, paths, and attached scripts.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'godot_add_node',
    description: 'Add a new node of a given type as a child of the specified parent node.',
    inputSchema: {
      type: 'object',
      properties: {
        parent_path: {
          type: 'string',
          description: "Parent node path. Use '.' for scene root, or a path like 'MyNode/SubNode'.",
          default: '.',
        },
        node_type: {
          type: 'string',
          description: 'Godot node class name (e.g., Sprite2D, Button, Label, Node3D, Timer, AnimationPlayer)',
          default: 'Node',
        },
        node_name: { type: 'string', description: 'Display name for the new node. Defaults to the type name.' },
      },
      required: ['node_type'],
    },
  },
  {
    name: 'godot_remove_node',
    description: 'Remove a node from the scene tree by its path.',
    inputSchema: {
      type: 'object',
      properties: {
        node_path: { type: 'string', description: 'Path to the node to remove (e.g., "MyNode/ChildToRemove")' },
      },
      required: ['node_path'],
    },
  },
  {
    name: 'godot_reparent_node',
    description: 'Reparent a node to a new parent node in the scene tree.',
    inputSchema: {
      type: 'object',
      properties: {
        node_path: { type: 'string', description: 'Path of the node to reparent' },
        new_parent_path: { type: 'string', description: 'Path of the target parent node' },
      },
      required: ['node_path', 'new_parent_path'],
    },
  },
  {
    name: 'godot_duplicate_node',
    description: 'Duplicate a node in the scene tree.',
    inputSchema: {
      type: 'object',
      properties: {
        node_path: { type: 'string', description: 'Path of the node to duplicate' },
      },
      required: ['node_path'],
    },
  },
  {
    name: 'godot_set_property',
    description: 'Set a named property on a scene node (e.g., position, scale, rotation, text, visible).',
    inputSchema: {
      type: 'object',
      properties: {
        node_path: { type: 'string', description: "Node path. Use '.' for root.", default: '.' },
        property: { type: 'string', description: 'Property name (e.g., position, scale, text, visible, rotation)' },
        value: { description: 'Property value. Type must match the property type.' },
      },
      required: ['property', 'value'],
    },
  },
  {
    name: 'godot_get_property',
    description: 'Read a property value from a scene node.',
    inputSchema: {
      type: 'object',
      properties: {
        node_path: { type: 'string', description: "Node path. Use '.' for root.", default: '.' },
        property: { type: 'string', description: 'Property name to read' },
      },
      required: ['property'],
    },
  },
  {
    name: 'godot_create_script',
    description: 'Create or overwrite a GDScript file in the project. Content should be valid GDScript 2.0.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path from res:// (e.g., "scripts/player.gd")' },
        content: { type: 'string', description: 'Full GDScript source code' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'godot_edit_script',
    description: 'Open a GDScript file in the Godot script editor.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Script path (res://...)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'godot_attach_script',
    description: 'Attach an existing GDScript resource to a scene node.',
    inputSchema: {
      type: 'object',
      properties: {
        node_path: { type: 'string', description: "Node path. Use '.' for root.", default: '.' },
        script_path: { type: 'string', description: 'Path to the GDScript file (res://...)' },
      },
      required: ['script_path'],
    },
  },
  {
    name: 'godot_detach_script',
    description: 'Remove a script from a scene node.',
    inputSchema: {
      type: 'object',
      properties: {
        node_path: { type: 'string', description: "Node path. Use '.' for root.", default: '.' },
      },
      required: ['node_path'],
    },
  },
  {
    name: 'godot_hot_reload_scripts',
    description: 'Trigger hot-reload of all GDScript resources in the project. Useful after batch script edits.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'godot_execute_code',
    description: 'Execute arbitrary GDScript code in the Godot editor context. Wrap return logic in a _run() function. Use sparingly for automation.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'GDScript code to execute. Define a _run() function to return values:\n\nfunc _run():\n    return Engine.get_frames_drawn()',
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'godot_run_scene',
    description: 'Play the current scene in Godot editor (equivalent to pressing F5).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'godot_stop_scene',
    description: 'Stop the running scene in Godot editor (equivalent to pressing F8).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'godot_list_files',
    description: 'List files and directories in a project folder.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path (res://...), defaults to project root', default: 'res://' },
        pattern: { type: 'string', description: 'Glob pattern filter', default: '*' },
      },
    },
  },
  {
    name: 'godot_read_file',
    description: 'Read the full contents of any project file as text.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path (res://...)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'godot_write_file',
    description: 'Write text content to a project file (creates or overwrites).',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path (res://...)' },
        content: { type: 'string', description: 'Text content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'godot_resource_load',
    description: 'Load and inspect a resource file (.tres, .res, .tscn) by path. Returns the resource class and serialized properties.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Resource path (res://...)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'godot_resource_save',
    description: 'Save a resource to a .tres or .res file. Creates or overwrites the resource file with specified properties.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Output path (res://...), must end in .tres or .res' },
        resource_class: { type: 'string', description: 'Resource class name (e.g., Resource, Script, Theme)', default: 'Resource' },
        properties: {
          type: 'object',
          description: 'Dictionary of property values to set on the resource',
          default: {},
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'godot_get_project_settings',
    description: 'Read one or all project settings (from project.godot / ProjectSettings).',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Specific setting key to read (e.g., "application/config/name"). Omit to return all settings.' },
      },
    },
  },
  {
    name: 'godot_set_project_settings',
    description: 'Set a project setting value. Use with caution — some settings require editor restart.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Setting key (e.g., "application/config/name")' },
        value: { description: 'Setting value' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'godot_connect_signal',
    description: 'Connect a signal from a node to a callable method on a target node.',
    inputSchema: {
      type: 'object',
      properties: {
        node_path: { type: 'string', description: 'Path of the node that emits the signal', default: '.' },
        signal_name: { type: 'string', description: 'Signal name (e.g., "pressed", "timeout", "body_entered")' },
        target_path: { type: 'string', description: 'Path of the target node with the method', default: '.' },
        method_name: { type: 'string', description: 'Method name on the target to call' },
        flags: { type: 'number', description: 'Connection flags (default: 0, use 1 for deferred, 2 for oneshot)', default: 0 },
      },
      required: ['signal_name', 'method_name'],
    },
  },
  {
    name: 'godot_disconnect_signal',
    description: 'Disconnect a previously connected signal.',
    inputSchema: {
      type: 'object',
      properties: {
        node_path: { type: 'string', description: 'Path of the node that emits the signal', default: '.' },
        signal_name: { type: 'string', description: 'Signal name' },
        target_path: { type: 'string', description: 'Path of the target node', default: '.' },
        method_name: { type: 'string', description: 'Method name' },
      },
      required: ['signal_name', 'method_name'],
    },
  },
  {
    name: 'godot_get_signal_list',
    description: 'List all available signals for a node, including inherited ones.',
    inputSchema: {
      type: 'object',
      properties: {
        node_path: { type: 'string', description: "Node path. Use '.' for root.", default: '.' },
      },
    },
  },
  {
    name: 'godot_get_export_presets',
    description: 'List all configured export presets for the project.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'godot_run_export',
    description: 'Run an export using a configured preset. Returns once export completes.',
    inputSchema: {
      type: 'object',
      properties: {
        preset_name: { type: 'string', description: 'Name of the export preset to use' },
        output_path: { type: 'string', description: 'Output file path (absolute or res://)' },
      },
      required: ['preset_name', 'output_path'],
    },
  },
  {
    name: 'godot_get_plugins',
    description: 'List all installed editor plugins and their enabled/disabled status.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'godot_set_plugin_enabled',
    description: 'Enable or disable an editor plugin by name.',
    inputSchema: {
      type: 'object',
      properties: {
        plugin_name: { type: 'string', description: 'Plugin name as defined in plugin.cfg' },
        enabled: { type: 'boolean', description: 'Whether to enable the plugin' },
      },
      required: ['plugin_name', 'enabled'],
    },
  },
  {
    name: 'godot_validate_script',
    description: 'Validate a GDScript file for syntax errors without loading it into a scene.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Script path (res://...)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'godot_get_asset_import_options',
    description: 'Get import options for an asset file (texture, audio, model, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Asset file path (res://...)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'godot_reimport_asset',
    description: 'Trigger reimport of an asset file.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Asset file path (res://...)' },
      },
      required: ['path'],
    },
  },
];

// ─── Resource Definitions ─────────────────────────────────────────────

const RESOURCES: Resource[] = [
  {
    uri: 'godot://project/info',
    name: 'Project Info',
    description: 'Current Godot project metadata (name, path, main scene)',
    mimeType: 'application/json',
  },
  {
    uri: 'godot://scene/tree',
    name: 'Scene Tree',
    description: 'Full hierarchy of the currently open scene',
    mimeType: 'application/json',
  },
  {
    uri: 'godot://project/structure',
    name: 'Project Structure',
    description: 'Directory listing of the project root',
    mimeType: 'application/json',
  },
  {
    uri: 'godot://connection/status',
    name: 'Connection Status',
    description: 'Current Godot editor connection health status',
    mimeType: 'application/json',
  },
];

// ─── Prompt Definitions ───────────────────────────────────────────────

const PROMPTS: Prompt[] = [
  {
    name: 'godot_create_2d_scene',
    description: 'Create a new 2D scene with a common setup (root, background, player)',
    arguments: [
      { name: 'scene_name', description: 'Name for the new 2D scene root', required: true },
    ],
  },
  {
    name: 'godot_create_3d_scene',
    description: 'Create a new 3D scene with a basic setup (Node3D root, camera, light)',
    arguments: [
      { name: 'scene_name', description: 'Name for the new 3D scene root', required: true },
    ],
  },
  {
    name: 'godot_create_ui_scene',
    description: 'Create a new UI scene with a Control root and common UI elements',
    arguments: [
      { name: 'scene_name', description: 'Name for the new UI scene root', required: true },
    ],
  },
  {
    name: 'godot_add_movement_script',
    description: 'Attach a basic movement script (WASD/arrow-keys) to a CharacterBody2D',
    arguments: [
      { name: 'node_path', description: 'Path to the CharacterBody2D node', required: true },
    ],
  },
  {
    name: 'godot_add_sprite_with_texture',
    description: 'Add a Sprite2D with a loaded texture from a specified path',
    arguments: [
      { name: 'parent_path', description: 'Parent node path', required: true },
      { name: 'texture_path', description: 'Path to the texture image (res://)', required: true },
    ],
  },
];

// ─── Tool Routing ─────────────────────────────────────────────────────

const METHOD_MAP: Record<string, string> = {
  godot_ping: 'ping',
  godot_health: 'health',
  godot_get_project_info: 'get_project_info',
  godot_create_scene: 'create_scene',
  godot_load_scene: 'load_scene',
  godot_save_scene: 'save_scene',
  godot_get_scene_tree: 'get_scene_tree',
  godot_add_node: 'add_node',
  godot_remove_node: 'remove_node',
  godot_reparent_node: 'reparent_node',
  godot_duplicate_node: 'duplicate_node',
  godot_set_property: 'set_property',
  godot_get_property: 'get_property',
  godot_create_script: 'create_script',
  godot_edit_script: 'edit_script',
  godot_attach_script: 'attach_script',
  godot_detach_script: 'detach_script',
  godot_hot_reload_scripts: 'hot_reload_scripts',
  godot_execute_code: 'execute_code',
  godot_run_scene: 'run_scene',
  godot_stop_scene: 'stop_scene',
  godot_list_files: 'list_files',
  godot_read_file: 'read_file',
  godot_write_file: 'write_file',
  godot_resource_load: 'resource_load',
  godot_resource_save: 'resource_save',
  godot_get_project_settings: 'get_project_settings',
  godot_set_project_settings: 'set_project_settings',
  godot_connect_signal: 'connect_signal',
  godot_disconnect_signal: 'disconnect_signal',
  godot_get_signal_list: 'get_signal_list',
  godot_get_export_presets: 'get_export_presets',
  godot_run_export: 'run_export',
  godot_get_plugins: 'get_plugins',
  godot_set_plugin_enabled: 'set_plugin_enabled',
  godot_validate_script: 'validate_script',
  godot_get_asset_import_options: 'get_asset_import_options',
  godot_reimport_asset: 'reimport_asset',
};

function removeBrand<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

async function handleToolCall(
  bridge: GodotBridge,
  name: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  if (name === 'godot_help') {
    const toolList = TOOLS.map((t) => `  ${t.name}: ${t.description}`).join('\n');
    return { content: [{ type: 'text', text: `Available tools (${TOOLS.length}):\n${toolList}` }] };
  }

  if (name === 'godot_health') {
    return { content: [{ type: 'text', text: JSON.stringify(bridge.status, null, 2) }] };
  }

  if (!bridge.connected) {
    if (name === 'godot_ping') {
      return {
        content: [{ type: 'text', text: JSON.stringify({ status: 'disconnected', message: 'Godot editor is not connected' }, null, 2) }],
      };
    }
    return {
      isError: true,
      content: [{ type: 'text', text: 'Not connected to Godot. Make sure the Godot MCP addon is enabled and the editor is open.' }],
    };
  }

  const method = METHOD_MAP[name];
  if (!method) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    };
  }

  try {
    const skipCacheNames = new Set(['godot_ping', 'godot_health']);
    const readOnlyMethods = new Set([
      'ping', 'get_project_info', 'get_scene_tree', 'get_property',
      'list_files', 'read_file', 'get_project_settings', 'get_signal_list',
      'get_export_presets', 'get_plugins', 'validate_script', 'get_asset_import_options',
    ]);

    const isReadOnly = readOnlyMethods.has(method);
    const options: Record<string, unknown> = {};

    if (!skipCacheNames.has(name) && !isReadOnly) {
      bridge.invalidateCache(method);
    }

    if (method === 'run_export') {
      options.timeout = 300_000;
    }

    const result = await bridge.call(method, args, options);

    if (result.error) {
      return {
        isError: true,
        content: [{ type: 'text', text: result.message as string || result.error as string }],
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Tool call failed', { tool: name, error: message });
    return {
      isError: true,
      content: [{ type: 'text', text: message }],
    };
  }
}

async function handleResourceRead(
  bridge: GodotBridge,
  uri: string
): Promise<{ contents: Array<{ uri: string; text: string; mimeType?: string }> }> {
  let result: Record<string, unknown>;

  switch (uri) {
    case 'godot://project/info':
      result = await bridge.call('get_project_info');
      return {
        contents: [{
          uri,
          text: JSON.stringify(result, null, 2),
          mimeType: 'application/json',
        }],
      };

    case 'godot://scene/tree':
      result = await bridge.call('get_scene_tree');
      return {
        contents: [{
          uri,
          text: JSON.stringify(result, null, 2),
          mimeType: 'application/json',
        }],
      };

    case 'godot://project/structure':
      result = await bridge.call('list_files', { path: 'res://' });
      return {
        contents: [{
          uri,
          text: JSON.stringify(result, null, 2),
          mimeType: 'application/json',
        }],
      };

    case 'godot://connection/status':
      return {
        contents: [{
          uri,
          text: JSON.stringify(bridge.status, null, 2),
          mimeType: 'application/json',
        }],
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
}

async function handlePromptGet(
  bridge: GodotBridge,
  name: string,
  args: Record<string, string | undefined>
): Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }> {
  const sceneName = args.scene_name || args.node_path || 'Unknown';

  switch (name) {
    case 'godot_create_2d_scene': {
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Create a 2D scene named "${sceneName}":

1. Use godot_create_scene with root_type="Node2D" and root_name="${sceneName}"
2. Add a Sprite2D child
3. Optionally add a Camera2D and set it as current`,
          },
        }],
      };
    }

    case 'godot_create_3d_scene': {
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Create a 3D scene named "${sceneName}":

1. Use godot_create_scene with root_type="Node3D" and root_name="${sceneName}"
2. Add a Camera3D child
3. Add a DirectionalLight3D child
4. Optionally add a WorldEnvironment`,
          },
        }],
      };
    }

    case 'godot_create_ui_scene': {
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Create a UI scene named "${sceneName}":

1. Use godot_create_scene with root_type="Control" and root_name="${sceneName}"
2. Add child controls: Button, Label, Panel
3. Layout using anchors or containers`,
          },
        }],
      };
    }

    case 'godot_add_movement_script': {
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Add WASD/Arrow-key movement to the CharacterBody2D at "${sceneName}":

1. Use godot_create_script to write a movement script
2. Use godot_attach_script to attach it to the node
3. The script should handle: input, velocity, move_and_slide()`,
          },
        }],
      };
    }

    case 'godot_add_sprite_with_texture': {
      const texturePath = args.texture_path || 'res://icon.svg';
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Add a Sprite2D with a texture to "${sceneName}":

1. Use godot_add_node with node_type="Sprite2D" under parent "${sceneName}"
2. Use godot_set_property to set "texture" to load("${texturePath}")`,
          },
        }],
      };
    }

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  const bridge = new GodotBridge();

  bridge.onConnected = () => {
    logger.info('Connected to Godot editor');
  };

  bridge.onDisconnected = () => {
    logger.warn('Disconnected from Godot editor — will auto-reconnect');
  };

  bridge.connect().catch(() => {
    logger.warn('Could not connect to Godot on startup. Will keep retrying in the background.');
    logger.info('Make sure your Godot project is open with the MCP addon enabled.');
  });

  const server = new Server(
    { name: 'godot-mcp', version: '2.0.0' },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map(removeBrand),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return handleToolCall(bridge, request.params.name, request.params.arguments ?? {});
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCES.map(removeBrand),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    return handleResourceRead(bridge, request.params.uri);
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: PROMPTS.map(removeBrand),
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const args: Record<string, string | undefined> = {};
    if (request.params.arguments) {
      for (const [key, value] of Object.entries(request.params.arguments)) {
        args[key] = typeof value === 'string' ? value : String(value);
      }
    }
    return handlePromptGet(bridge, request.params.name, args);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Server running on stdio');

  process.on('SIGINT', () => {
    logger.info('Shutting down...');
    bridge.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Shutting down...');
    bridge.disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error('Fatal error during startup', { error: String(err) });
  process.exit(1);
});

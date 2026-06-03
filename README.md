# Godot MCP Server

Production-grade [Model Context Protocol](https://modelcontextprotocol.io) server for controlling the **Godot 4.x** game engine from any MCP client (opencode, Claude, VS Code, etc.).

```
Client (opencode)  ←stdio→  MCP Server (Node.js)  ←WebSocket→  Godot Editor (GDScript Addon)
```

## Features

- **40+ tools** — scene manipulation, scripting, file I/O, project settings, signals, export, plugins, resources
- **MCP Resources** — project info, scene tree, project structure, connection status
- **MCP Prompts** — reusable templates for common Godot workflows
- **Health monitoring** — auto-reconnect, uptime tracking, connection status
- **Request queuing** — prevents race conditions when multiple tools fire in parallel
- **Response caching** — read-only results cached for performance
- **Structured logging** — timestamps, log levels (debug/info/warn/error)
- **Path traversal protection** — all file operations validated against project root
- **Command allowlist** — only known commands can be dispatched
- **Input sanitization** — shell-safe parameter handling
- **Graceful shutdown** — clean exit without zombie processes

## Quick Start

### 0. One-Command Installer (macOS / Windows / Linux)

```bash
python install.py
```

The installer will:
1. Check prerequisites (Node.js, npm, Python)
2. Run `npm install` + `npm run build` in `mcp-server/`
3. Auto-detect opencode config location and add the godot server entry
4. Optionally find your Godot projects and install the addon

**Non-interactive mode:**
```bash
python install.py --project-dir ~/mygame --no-build
# --no-build: skip npm build (use after code changes)
# --no-addon: skip Godot addon installation
# --config-path: specify opencode config location
```

### 1. Install the Godot Addon (Manual)

Copy the addon folder into your Godot project:

```bash
cp -r godot-addon/addons/godot_mcp /path/to/your/godot/project/addons/
```

Enable it: **Project → Project Settings → Plugins → Godot MCP → Enable**

The addon starts a WebSocket server on `ws://localhost:9080`.

### 2. Build the MCP Server (Manual)

```bash
cd mcp-server
npm install
npm run build
```

### 3. Configure Your MCP Client

**opencode.json:**
```json
{
  "mcpServers": {
    "godot": {
      "command": "node",
      "args": ["/absolute/path/to/godot-mcp/mcp-server/build/index.js"]
    }
  }
}
```

**Claude Desktop config (`claude_desktop_config.json`):**
```json
{
  "mcpServers": {
    "godot": {
      "command": "node",
      "args": ["/absolute/path/to/godot-mcp/mcp-server/build/index.js"]
    }
  }
}
```

### 4. Run

1. Open your Godot project (with the MCP addon enabled)
2. Start your MCP client — it will connect to Godot automatically

## Tool Reference

### Scene Tools

| Tool | Description |
|------|-------------|
| `godot_create_scene` | Create a new scene (root_type: Node2D, Node3D, Control) |
| `godot_load_scene` | Open a scene file (res://...) |
| `godot_save_scene` | Save the current scene |
| `godot_get_scene_tree` | Get full scene hierarchy tree |
| `godot_add_node` | Add a child node (60+ node types) |
| `godot_remove_node` | Remove a node by path |
| `godot_reparent_node` | Move a node to a new parent |
| `godot_duplicate_node` | Duplicate a node in the tree |

### Property Tools

| Tool | Description |
|------|-------------|
| `godot_set_property` | Set a property on a node (position, text, visible, etc.) |
| `godot_get_property` | Read a property value from a node |

### Scripting Tools

| Tool | Description |
|------|-------------|
| `godot_create_script` | Create or overwrite a .gd file |
| `godot_edit_script` | Open a script in the editor |
| `godot_attach_script` | Attach a GDScript to a node |
| `godot_detach_script` | Remove a script from a node |
| `godot_hot_reload_scripts` | Reload all GDScripts in the project |
| `godot_execute_code` | Run arbitrary GDScript code |
| `godot_validate_script` | Check a script for syntax errors |

### File / Resource Tools

| Tool | Description |
|------|-------------|
| `godot_list_files` | List files in a project directory |
| `godot_read_file` | Read file contents as text |
| `godot_write_file` | Write text to a file (creates directories as needed) |
| `godot_resource_load` | Load and inspect a .tres/.res resource |
| `godot_resource_save` | Create and save a resource file |
| `godot_reimport_asset` | Trigger asset reimport |

### Project Settings

| Tool | Description |
|------|-------------|
| `godot_get_project_info` | Get project name, path, main scene, engine version |
| `godot_get_project_settings` | Read project settings (one or all) |
| `godot_set_project_settings` | Write a project setting value |

### Signal Tools

| Tool | Description |
|------|-------------|
| `godot_connect_signal` | Connect a signal to a method |
| `godot_disconnect_signal` | Disconnect a signal |
| `godot_get_signal_list` | List all signals for a node |

### Export / Plugin Tools

| Tool | Description |
|------|-------------|
| `godot_get_export_presets` | List export presets |
| `godot_run_export` | Export project using a preset |
| `godot_get_plugins` | List editor plugins |
| `godot_set_plugin_enabled` | Enable/disable a plugin |

### Runtime / Health Tools

| Tool | Description |
|------|-------------|
| `godot_run_scene` | Play the current scene (F5) |
| `godot_stop_scene` | Stop running scene (F8) |
| `godot_ping` | Check if Godot editor is connected |
| `godot_health` | Get detailed connection health status |
| `godot_help` | List all available tools |

### Asset Import

| Tool | Description |
|------|-------------|
| `godot_get_asset_import_options` | Get import options for an asset |
| `godot_reimport_asset` | Trigger reimport of an asset |

## Resources

| URI | Description |
|-----|-------------|
| `godot://project/info` | Current project metadata |
| `godot://scene/tree` | Open scene hierarchy |
| `godot://project/structure` | Project directory listing |
| `godot://connection/status` | Godot editor connection health |

## Prompts

| Prompt | Description |
|--------|-------------|
| `godot_create_2d_scene` | Template for creating 2D scenes with common setup |
| `godot_create_3d_scene` | Template for creating 3D scenes with camera + light |
| `godot_create_ui_scene` | Template for creating UI scenes with controls |
| `godot_add_movement_script` | Template for adding WASD movement script to CharacterBody2D |
| `godot_add_sprite_with_texture` | Template for adding a textured Sprite2D |

## Example Workflows

### "Create a scene with a player character"

1. `godot_create_scene` root_type="Node2D" root_name="Game"
2. `godot_add_node` parent_path="." node_type="CharacterBody2D" node_name="Player"
3. `godot_add_node` parent_path="Player" node_type="CollisionShape2D"
4. `godot_create_script` path="player.gd" content="# ... movement code ..."
5. `godot_attach_script` node_path="Player" script_path="res://player.gd"
6. `godot_set_property` node_path="Player/Sprite2D" property="texture" value={...}

### "Set up a UI with a button"

1. `godot_create_scene` root_type="Control" root_name="MainMenu"
2. `godot_add_node` node_type="Button" node_name="StartButton"
3. `godot_set_property` node_path="StartButton" property="text" value="Start Game"
4. `godot_set_property` node_path="StartButton" property="position" value={"x": 100, "y": 100}

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP Client (opencode)                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │  stdio (JSON-RPC)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  mcp-server/src/index.ts                                        │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌────────────┐ │
│  │  Route   │  │   Tool       │  │ Resource │  │  Prompt    │ │
│  │  Handler │──│  Executor    │──│  Handler │──│  Handler   │ │
│  └────┬─────┘  └──────┬───────┘  └──────────┘  └────────────┘ │
│       │               │                                          │
│  ┌────▼───────────────▼──────────────────────────────────────┐  │
│  │  GodotBridge (godot-bridge.ts)                             │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐   │  │
│  │  │  Queue   │  │  Cache   │  │  Health  │  │  WS     │   │  │
│  │  │  Engine  │  │  Manager │  │  Checks  │  │  Client │   │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └────┬────┘   │  │
│  └──────────────────────────────────────────────────┼─────────┘  │
└─────────────────────────────────────────────────────┼────────────┘
                                                      │ WebSocket
                                                      │ JSON-RPC
┌─────────────────────────────────────────────────────┼────────────┐
│  Godot Editor (godot-addon)                         │            │
│  ┌──────────────────────────────────────────────────▼──────────┐ │
│  │  mcp_server.gd                                              │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │ │
│  │  │  WS      │  │  Router  │  │  Tool    │  │  Security │  │ │
│  │  │  Server  │──│  (match) │──│  Funcs   │──│  (path,   │  │ │
│  │  │          │  │          │  │  (40+)   │  │   name)   │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  EditorInterface  │  ResourceSaver  │  EditorScript ...    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Development

```bash
# Watch mode (auto-restart on changes)
npm run dev

# Build
npm run build

# Type-check
npm run lint

# Run tests
npm test

# Test with coverage
npm run test:coverage
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Not connected to Godot" | Ensure Godot is open with the MCP addon enabled |
| WebSocket connection refused | Check port 9080 is not in use; restart Godot |
| Tools return "not_in_editor" | Commands require the Godot editor to be running |
| Scene not saving | Provide a `path` for untitled scenes |
| Node not found | Use the exact path — check with `godot_get_scene_tree` |
| Script errors on execute | Wrap return logic in `func _run():` |
| Addon not appearing | Verify folder is at `addons/godot_mcp/` with all 3 files |
| "Path traversal" error | All file paths must resolve within the project directory |

## Project Structure

```
godot-mcp/
├── install.py                # Cross-platform installer (macOS/Windows/Linux)
├── opencode.json             # MCP server config (reference)
├── README.md
├── godot-addon/
│   └── addons/godot_mcp/
│       ├── plugin.cfg         # Plugin metadata
│       ├── plugin.gd          # EditorPlugin entry
│       └── mcp_server.gd      # WebSocket server + 40+ tools
└── mcp-server/
    ├── package.json
    ├── tsconfig.json
    ├── vitest.config.ts
    ├── src/
    │   ├── index.ts           # MCP server + tool routing
    │   ├── godot-bridge.ts    # WebSocket client + health + queue + cache
    │   ├── types.ts           # Shared type definitions
    │   ├── logger.ts          # Structured logging
    │   ├── security.ts        # Path validation + input sanitization
    │   ├── queue.ts           # Request queue for concurrent safety
    │   ├── cache.ts           # Response cache for read-only tools
    │   └── tools/             # (reserved for per-tool modules)
    ├── build/                 # Compiled output
    └── tests/
        └── ...                # Unit tests
```

## Compatibility

- Godot **4.2+** — uses GDScript 2.0, EditorPlugin, WebSocketServer, EditorInterface
- Node.js **18+** — requires ES2022 support
- MCP SDK **1.8+** — full spec compliance

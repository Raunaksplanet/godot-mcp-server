#!/usr/bin/env python3
"""
Godot MCP Server — Cross-platform installer.

Installs/configures the Godot MCP server for opencode on macOS, Windows, and Linux.

Usage:
    python install.py                          # Interactive mode
    python install.py --help                   # Show help
    python install.py --project-dir ~/mygame   # Specify Godot project
    python install.py --no-addon               # Skip addon install
    python install.py --no-build               # Skip npm build
"""

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

# ── ANSI colors ─────────────────────────────────────────────────────────
try:
    _TERM = sys.stdout.isatty()
except Exception:
    _TERM = False


def _color(code: str, text: str) -> str:
    if not _TERM:
        return text
    return f"{code}{text}\033[0m"


def green(t: str) -> str:
    return _color("\033[92m", t)


def yellow(t: str) -> str:
    return _color("\033[93m", t)


def red(t: str) -> str:
    return _color("\033[91m", t)


def cyan(t: str) -> str:
    return _color("\033[96m", t)


def bold(t: str) -> str:
    return _color("\033[1m", t)


# ── Paths ────────────────────────────────────────────────────────────────

INSTALL_DIR = Path(__file__).resolve().parent
MCP_SERVER_DIR = INSTALL_DIR / "mcp-server"
GODOT_ADDON_SRC = INSTALL_DIR / "godot-addon" / "addons" / "godot_mcp"
BUILD_ENTRY = MCP_SERVER_DIR / "build" / "index.js"


def get_opencode_config_dir() -> Path:
    """Return the opencode config directory for the current platform."""
    system = platform.system()
    if system == "Windows":
        base = os.environ.get("APPDATA")
        if not base:
            base = Path.home() / "AppData" / "Roaming"
        return Path(base) / "opencode"
    elif system == "Darwin":
        return Path.home() / ".config" / "opencode"
    else:
        xdg = os.environ.get("XDG_CONFIG_HOME")
        if xdg:
            return Path(xdg) / "opencode"
        return Path.home() / ".config" / "opencode"


def get_opencode_config_path() -> Path:
    return get_opencode_config_dir() / "opencode.json"


def find_godot_projects() -> list[Path]:
    """Scan home directory for Godot projects (contain project.godot)."""
    projects = []
    search_root = Path.home()
    for candidate in search_root.iterdir():
        if candidate.is_dir():
            project_file = candidate / "project.godot"
            if project_file.exists():
                projects.append(candidate)
    return projects


# ── Pre-flight checks ────────────────────────────────────────────────────

def check_prerequisites() -> bool:
    """Verify node, npm, python are available. Return False on fatal."""
    ok = True

    node_path = shutil.which("node")
    if node_path:
        try:
            ver = subprocess.run([node_path, "--version"], capture_output=True, text=True, check=True).stdout.strip()
            print(f"  {green('✓')} Node.js: {ver}  ({node_path})")
        except Exception:
            print(f"  {red('✗')} Node.js: found but couldn't check version")
            ok = False
    else:
        print(f"  {red('✗')} Node.js: not found — install from https://nodejs.org (v18+)")
        ok = False

    npm_path = shutil.which("npm")
    if npm_path:
        try:
            ver = subprocess.run([npm_path, "--version"], capture_output=True, text=True, check=True).stdout.strip()
            print(f"  {green('✓')} npm: v{ver}  ({npm_path})")
        except Exception:
            print(f"  {red('✗')} npm: found but couldn't check version")
            ok = False
    else:
        print(f"  {red('✗')} npm: not found (usually bundled with Node.js)")
        ok = False

    print(f"  {green('✓')} Python: {sys.version.split()[0]}")
    print(f"  {green('✓')} Platform: {platform.system()} {platform.release()}")
    print(f"  {green('✓')} Install dir: {INSTALL_DIR}")

    return ok


# ── Build MCP server ─────────────────────────────────────────────────────

def build_mcp_server() -> bool:
    """Run npm install + npm run build in mcp-server/."""
    print(f"\n  {bold('Building MCP server...')}")
    if not MCP_SERVER_DIR.exists():
        print(f"  {red('✗')} mcp-server directory not found: {MCP_SERVER_DIR}")
        return False

    print(f"  Running npm install in {MCP_SERVER_DIR}...")
    try:
        subprocess.run(
            ["npm", "install"],
            cwd=str(MCP_SERVER_DIR),
            check=True,
            capture_output=True,
        )
        print(f"  {green('✓')} npm install complete")
    except subprocess.CalledProcessError as e:
        err = e.stderr.decode() if e.stderr else "unknown error"
        print(f"  {red('✗')} npm install failed: {err.strip()}")
        return False

    print(f"  Running npm run build...")
    try:
        subprocess.run(
            ["npm", "run", "build"],
            cwd=str(MCP_SERVER_DIR),
            check=True,
            capture_output=True,
        )
        print(f"  {green('✓')} npm build complete")
    except subprocess.CalledProcessError as e:
        err = e.stderr.decode() if e.stderr else "unknown error"
        print(f"  {red('✗')} npm build failed: {err.strip()}")
        return False

    if BUILD_ENTRY.exists():
        print(f"  {green('✓')} Built entry point: {BUILD_ENTRY}")
        return True
    else:
        print(f"  {red('✗')} Build output not found at {BUILD_ENTRY}")
        return False


# ── Install Godot addon ──────────────────────────────────────────────────

def install_addon(project_dir: Path) -> bool:
    """Copy godot_mcp addon folder into the Godot project's addons/."""
    addon_dst = project_dir / "addons" / "godot_mcp"

    if addon_dst.exists():
        resp = input(f"  {yellow('⚠')} Addon already exists at {addon_dst}. Overwrite? [y/N] ").strip().lower()
        if resp != "y":
            print(f"  {yellow('⚠')} Skipping addon install")
            return True

    print(f"  Copying addon to {addon_dst}...")
    addon_dst.parent.mkdir(parents=True, exist_ok=True)
    if addon_dst.exists():
        shutil.rmtree(addon_dst)
    shutil.copytree(str(GODOT_ADDON_SRC), str(addon_dst))

    print(f"  {green('✓')} Addon installed")
    print(f"  {yellow('ℹ')} Enable it in Godot: Project → Project Settings → Plugins → Godot MCP → Enable")
    return True


# ── Configure opencode ───────────────────────────────────────────────────

def ensure_opencode_config() -> Path:
    """Create opencode config dir if missing, return config path."""
    config_dir = get_opencode_config_dir()
    config_dir.mkdir(parents=True, exist_ok=True)
    return get_opencode_config_path()


def load_opencode_config(config_path: Path) -> dict:
    """Load opencode config, return parsed JSON (or empty skeleton)."""
    if config_path.exists():
        try:
            with open(config_path, encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            print(f"  {yellow('⚠')} Could not parse {config_path}, creating new config")
    return {"$schema": "https://opencode.ai/config.json", "mcp": {}}


def save_opencode_config(config_path: Path, config: dict):
    """Write opencode config, preserving existing entries."""
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
        f.write("\n")


def configure_mcp(config: dict) -> dict:
    """Add/update the godot MCP server entry in the config dict."""
    if "mcp" not in config:
        config["mcp"] = {}

    config["mcp"]["godot"] = {
        "type": "local",
        "command": ["node", str(BUILD_ENTRY.resolve())],
        "environment": {
            "GODOT_WS_HOST": "localhost",
            "GODOT_WS_PORT": "9080",
        },
        "enabled": True,
    }

    return config


# ── Main ─────────────────────────────────────────────────────────────────

def print_banner():
    print()
    print(bold(f"  Godot MCP Server — Installer v2.0.0"))
    print(f"  {cyan('━' * 50)}")
    print(f"  Platform: {platform.system()} {platform.release()}")
    print()


def print_summary(opencode_config_path: Path, addon_installed: bool, project_dir: Path | None):
    print()
    print(f"  {bold(green('✓ Installation complete!'))}")
    print(f"  {cyan('━' * 50)}")
    print(f"  MCP server entry added to: {opencode_config_path}")
    print(f"  Server path: {BUILD_ENTRY.resolve()}")
    if addon_installed and project_dir:
        print(f"  Godot addon installed at: {project_dir / 'addons' / 'godot_mcp'}")
    print()
    print(f"  {bold('Next steps:')}")
    print(f"  1. Open your Godot project")
    if addon_installed and project_dir:
        print(f"  2. Enable the addon: Project → Project Settings → Plugins → Godot MCP → Enable")
        print(f"  3. Restart opencode — it will connect to Godot automatically")
    else:
        print(f"  2. Copy addon manually: cp -r godot-addon/addons/godot_mcp <your-project>/addons/")
        print(f"  3. Enable the addon in Godot (Project → Plugins)")
        print(f"  4. Restart opencode")
    print(f"  {bold('Troubleshooting:')}")
    print(f"  - Run: node {BUILD_ENTRY.resolve()}   (test the server)")
    print(f"  - Ensure port 9080 is free")
    print(f"  - Check opencode MCP section for 'godot' server status")
    print(f"  {cyan('━' * 50)}")
    print()


def interactive_addon_install():
    """Ask user about Godot project for addon installation."""
    print(f"\n  {bold('Godot Addon Installation')}")
    print(f"  {yellow('ℹ')} The addon lets Godot talk to the MCP server over WebSocket.")
    print(f"  {yellow('ℹ')} It needs to be inside your Godot project's addons/ folder.")
    print()

    projects = find_godot_projects()
    if projects:
        print(f"  Found {len(projects)} Godot project(s):")
        for i, p in enumerate(projects, 1):
            print(f"    {i}. {p}")
        print()

    resp = input(f"  Path to your Godot project (or Enter to skip): ").strip()
    if not resp:
        print(f"  {yellow('ℹ')} Skipping addon install")
        return None

    resp = resp.replace("~", str(Path.home()))
    project_dir = Path(resp).resolve()

    if not project_dir.is_dir():
        print(f"  {red('✗')} Directory not found: {project_dir}")
        return None

    if not (project_dir / "project.godot").exists():
        print(f"  {yellow('⚠')} No project.godot found in {project_dir}")
        confirm = input(f"  Install anyway? [y/N] ").strip().lower()
        if confirm != "y":
            return None

    if install_addon(project_dir):
        return project_dir
    return None


def parse_args():
    parser = argparse.ArgumentParser(
        description="Install and configure the Godot MCP server for opencode",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python install.py\n"
            "  python install.py --project-dir ~/mygame\n"
            "  python install.py --no-build --no-addon\n"
        ),
    )
    parser.add_argument(
        "--project-dir",
        help="Path to Godot project (installs the addon automatically)",
    )
    parser.add_argument(
        "--no-build",
        action="store_true",
        help="Skip npm install and build step",
    )
    parser.add_argument(
        "--no-addon",
        action="store_true",
        help="Skip Godot addon installation",
    )
    parser.add_argument(
        "--config-path",
        help="Path to opencode config file (default: auto-detect)",
    )
    return parser.parse_args()


def main():
    print_banner()

    args = parse_args()

    # ── Pre-flight ───────────────────────────────────────────────────
    print(f"  {bold('Checking prerequisites...')}")
    if not check_prerequisites():
        print(f"  {red('✗')} Prerequisites not met. Please fix the issues above and re-run.")
        sys.exit(1)

    # ── Build MCP server ─────────────────────────────────────────────
    if args.no_build:
        if not BUILD_ENTRY.exists():
            print(f"  {red('✗')} --no-build specified but {BUILD_ENTRY} doesn't exist. Run build first.")
            sys.exit(1)
        print(f"  {yellow('ℹ')} Skipping build (--no-build)")
    else:
        if not build_mcp_server():
            print(f"  {red('✗')} Build failed. See errors above.")
            sys.exit(1)

    # ── Configure opencode ───────────────────────────────────────────
    print(f"\n  {bold('Configuring opencode...')}")
    config_path = Path(args.config_path) if args.config_path else ensure_opencode_config()
    print(f"  Config file: {config_path}")

    try:
        config = load_opencode_config(config_path)
        config = configure_mcp(config)
        save_opencode_config(config_path, config)
        print(f"  {green('✓')} Godot MCP server added to opencode config")
    except Exception as e:
        print(f"  {red('✗')} Failed to write config: {e}")
        sys.exit(1)

    # ── Install Godot addon ──────────────────────────────────────────
    addon_installed = False
    project_dir = None

    if args.no_addon:
        print(f"  {yellow('ℹ')} Skipping addon install (--no-addon)")
    elif args.project_dir:
        pd = Path(args.project_dir).expanduser().resolve()
        if pd.is_dir():
            if install_addon(pd):
                addon_installed = True
                project_dir = pd
        else:
            print(f"  {red('✗')} Project directory not found: {pd}")
    else:
        project_dir = interactive_addon_install()
        if project_dir:
            addon_installed = True

    # ── Summary ──────────────────────────────────────────────────────
    print_summary(config_path, addon_installed, project_dir)


if __name__ == "__main__":
    main()

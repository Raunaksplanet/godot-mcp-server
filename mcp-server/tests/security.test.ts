import { describe, it, expect } from 'vitest';
import { SecurityManager } from '../src/security.js';
import path from 'node:path';

const PROJECT_ROOT = '/Users/test/godot-project';

describe('SecurityManager', () => {
  const security = new SecurityManager(PROJECT_ROOT);

  describe('validateFilePath', () => {
    it('should allow paths within project root', () => {
      const result = security.validateFilePath(path.join(PROJECT_ROOT, 'scenes/game.tscn'));
      expect(result).toBe(path.join(PROJECT_ROOT, 'scenes/game.tscn'));
    });

    it('should allow res:// paths', () => {
      const result = security.validateFilePath('res://scenes/game.tscn');
      expect(result).toBe(path.join(PROJECT_ROOT, 'scenes/game.tscn'));
    });

    it('should reject paths outside project root', () => {
      expect(() => security.validateFilePath('/etc/passwd')).toThrow('Path traversal denied');
    });

    it('should reject ../ traversal escaping', () => {
      expect(() => security.validateFilePath(path.join(PROJECT_ROOT, '../../etc/passwd'))).toThrow('Path traversal denied');
    });

    it('should reject res://../ traversal', () => {
      expect(() => security.validateFilePath('res://../../etc/passwd')).toThrow('Path traversal denied');
    });

    it('should reject empty paths', () => {
      expect(() => security.validateFilePath('')).toThrow('non-empty string');
    });

    it('should reject non-string paths', () => {
      expect(() => security.validateFilePath(null as unknown as string)).toThrow('non-empty string');
    });
  });

  describe('sanitizeShellInput', () => {
    it('should remove shell metacharacters', () => {
      const result = security.sanitizeShellInput('hello; ls -la');
      expect(result).toBe('hello ls -la');
    });

    it('should remove semicolons and backticks', () => {
      const result = security.sanitizeShellInput('echo `hostname`; cat');
      expect(result).toBe('echo hostname cat');
    });

    it('should preserve forward slashes in paths', () => {
      const result = security.sanitizeShellInput('/usr/bin/godot');
      expect(result).toBe('/usr/bin/godot');
    });

    it('should trim whitespace', () => {
      const result = security.sanitizeShellInput('  safe  ');
      expect(result).toBe('safe');
    });

    it('should handle empty strings', () => {
      expect(security.sanitizeShellInput('')).toBe('');
    });

    it('should handle non-string inputs', () => {
      expect(security.sanitizeShellInput(null as unknown as string)).toBe('');
    });
  });

  describe('validateCommand', () => {
    it('should allow known commands', () => {
      expect(() => security.validateCommand('ping')).not.toThrow();
      expect(() => security.validateCommand('create_scene')).not.toThrow();
    });

    it('should reject unknown commands', () => {
      expect(() => security.validateCommand('rm_rf')).toThrow('allowlist');
    });
  });

  describe('sanitizeNodeName', () => {
    it('should replace invalid characters', () => {
      expect(security.sanitizeNodeName('hello world!')).toBe('hello_world_');
    });

    it('should keep valid names unchanged', () => {
      expect(security.sanitizeNodeName('PlayerCharacter')).toBe('PlayerCharacter');
    });
  });
});

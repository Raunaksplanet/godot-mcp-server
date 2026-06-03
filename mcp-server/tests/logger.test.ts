import { describe, it, expect } from 'vitest';
import { Logger } from '../src/logger.js';

describe('Logger', () => {
  it('should create log entries without errors', () => {
    const logger = new Logger('Test');
    expect(() => {
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
    }).not.toThrow();
  });

  it('should include module name in output', () => {
    const logger = new Logger('TestModule');
    let output = '';
    const spy = vi.spyOn(console, 'error').mockImplementation((msg: string) => {
      output += msg;
    });
    logger.info('hello');
    expect(output).toContain('TestModule');
    spy.mockRestore();
  });
});

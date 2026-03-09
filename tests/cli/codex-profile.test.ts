import { describe, expect, it } from 'vitest';
import { CodexOutputParser, CODEX_PROFILE, getProfile } from '../../packages/cli/src/adapters/profiles.js';

describe('CodexOutputParser', () => {
  it('parses output_text message events as chunks', () => {
    const parser = new CodexOutputParser();
    const event = JSON.stringify({
      type: 'message',
      message: {
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Hello world' }],
      },
    });
    const result = parser.parseLine(event);
    expect(result).toEqual({ type: 'chunk', text: 'Hello world' });
  });

  it('parses completed events as done', () => {
    const parser = new CodexOutputParser();
    const result = parser.parseLine(JSON.stringify({ type: 'completed' }));
    expect(result).toEqual({ type: 'done' });
  });

  it('parses error events', () => {
    const parser = new CodexOutputParser();
    const result = parser.parseLine(JSON.stringify({ type: 'error', message: 'something failed' }));
    expect(result).toEqual({ type: 'error', message: 'something failed' });
  });

  it('returns null for empty lines', () => {
    const parser = new CodexOutputParser();
    expect(parser.parseLine('')).toBeNull();
    expect(parser.parseLine('   ')).toBeNull();
  });

  it('returns null for non-JSON lines', () => {
    const parser = new CodexOutputParser();
    expect(parser.parseLine('not json')).toBeNull();
  });

  it('returns null for unrecognized event types', () => {
    const parser = new CodexOutputParser();
    expect(parser.parseLine(JSON.stringify({ type: 'ping' }))).toBeNull();
  });
});

describe('CODEX_PROFILE', () => {
  it('builds correct args with --json flag', () => {
    const args = CODEX_PROFILE.buildArgs('say hello');
    expect(args).toEqual(['exec', '--json', 'say hello']);
  });

  it('ignores resumeSessionId', () => {
    const args = CODEX_PROFILE.buildArgs('say hello', 'session-123');
    expect(args).toEqual(['exec', '--json', 'say hello']);
  });

  it('does not set autoEmitDoneOnExit (parser emits done)', () => {
    expect(CODEX_PROFILE.autoEmitDoneOnExit).toBeUndefined();
  });

  it('passes through OPENAI_API_KEY', () => {
    expect(CODEX_PROFILE.envPassthroughKeys).toContain('OPENAI_API_KEY');
  });
});

describe('getProfile', () => {
  it('returns codex profile', () => {
    const profile = getProfile('codex');
    expect(profile.command).toBe('codex');
    expect(profile.displayName).toBe('Codex CLI');
  });

  it('returns claude profile', () => {
    const profile = getProfile('claude');
    expect(profile.command).toBe('claude');
  });

  it('throws for unknown profile', () => {
    expect(() => getProfile('unknown')).toThrow('Unknown agent type: unknown');
  });
});

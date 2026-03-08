import { describe, expect, it } from 'vitest';
import { buildPlatformPayload } from '../../packages/cli/src/providers/index.js';

describe('buildPlatformPayload', () => {
  it('marks exposed agents as published and preserves daemon metadata', () => {
    const payload = buildPlatformPayload({
      id: 'agent-1',
      slug: 'daemon-smoke',
      name: 'Daemon Smoke',
      runtimeType: 'claude',
      projectPath: '/tmp/project',
      sandbox: false,
      description: 'smoke test',
      capabilities: ['chat'],
      visibility: 'unlisted',
      createdAt: '2026-03-08T00:00:00.000Z',
      updatedAt: '2026-03-08T00:00:00.000Z',
    });

    expect(payload).toEqual({
      name: 'Daemon Smoke',
      slug: 'daemon-smoke',
      description: 'smoke test',
      agent_type: 'claude',
      visibility: 'private',
      capabilities: ['chat'],
      is_published: true,
    });
  });
});

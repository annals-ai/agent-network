import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DaemonStore } from '../../packages/cli/src/daemon/store.js';
import { GenericA2AProvider } from '../../packages/cli/src/providers/generic-a2a.js';
import type { DaemonAgent, SessionRecord } from '../../packages/cli/src/daemon/types.js';

describe('GenericA2AProvider', () => {
  let tempDir: string;
  let store: DaemonStore;
  let provider: GenericA2AProvider;
  let agent: DaemonAgent;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agent-network-generic-a2a-'));
    store = new DaemonStore(join(tempDir, 'state.db'));
    provider = new GenericA2AProvider();
    agent = store.createAgent({
      name: 'Generic A2A Agent',
      slug: 'generic-a2a-agent',
      projectPath: '/tmp/generic-a2a-agent',
      visibility: 'private',
      capabilities: ['review'],
    });
  });

  afterEach(async () => {
    await provider.shutdown();
    store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('serves card and jsonrpc task flow through the daemon runtime', async () => {
    const binding = store.upsertProviderBinding({
      agentId: agent.id,
      provider: 'generic-a2a',
      status: 'configured',
      config: {
        port: 0,
        bearerToken: 'test-token',
      },
      lastSyncedAt: '2026-03-08T00:00:00.000Z',
    });

    const runtime = {
      async execute(input: { sessionId?: string; message: string }): Promise<{ session: SessionRecord; agent: DaemonAgent; result: string }> {
        let session = input.sessionId ? store.getSession(input.sessionId) : null;
        if (!session) {
          session = store.createSession({
            id: input.sessionId,
            agentId: agent.id,
            origin: 'generic_a2a',
            principalType: 'generic_a2a',
            principalId: 'test',
            status: 'idle',
            title: 'A2A task',
          });
        }

        store.appendMessage({
          sessionId: session.id,
          role: 'user',
          kind: 'call',
          content: input.message,
        });
        store.appendMessage({
          sessionId: session.id,
          role: 'assistant',
          kind: 'call',
          content: 'PONG',
        });
        session = store.updateSession(session.id, {
          status: 'idle',
          touchLastActive: true,
        });

        return {
          session,
          agent,
          result: 'PONG',
        };
      },
      stopSession(sessionId: string): SessionRecord {
        return store.stopSession(sessionId);
      },
    } as const;

    await provider.startIngress({
      agent,
      binding,
      store,
      runtime: runtime as never,
    });

    const liveBinding = store.getProviderBinding(agent.id, 'generic-a2a');
    expect(liveBinding?.status).toBe('online');
    expect(typeof liveBinding?.config.cardUrl).toBe('string');
    expect(typeof liveBinding?.config.jsonrpcUrl).toBe('string');

    const cardResponse = await fetch(String(liveBinding?.config.cardUrl), {
      headers: {
        Authorization: 'Bearer test-token',
      },
    });
    expect(cardResponse.status).toBe(200);
    const card = await cardResponse.json() as { name: string; url: string; capabilities: { streaming: boolean; async: boolean } };
    expect(card.name).toBe('Generic A2A Agent');
    expect(card.url).toBe(String(liveBinding?.config.jsonrpcUrl));
    expect(card.capabilities).toMatchObject({
      streaming: false,
      async: true,
    });

    const unauthorizedResponse = await fetch(String(liveBinding?.config.jsonrpcUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'GetExtendedAgentCard',
      }),
    });
    expect(unauthorizedResponse.status).toBe(401);

    const rpcResponse = await fetch(String(liveBinding?.config.jsonrpcUrl), {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'SendMessage',
        params: {
          contextId: 'task-1',
          message: {
            parts: [{ type: 'text', text: 'ping' }],
          },
        },
      }),
    });
    expect(rpcResponse.status).toBe(200);
    const rpc = await rpcResponse.json() as {
      result: {
        task: {
          id: string;
          state: string;
          messages: Array<{ role: string; parts: Array<{ text: string }> }>;
        };
      };
    };
    expect(rpc.result.task.id).toBe('task-1');
    expect(rpc.result.task.state).toBe('TASK_STATE_COMPLETED');
    expect(rpc.result.task.messages.at(-1)?.parts[0]?.text).toBe('PONG');
  });
});

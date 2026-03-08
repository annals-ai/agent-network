import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentMeshDaemonServer } from '../../packages/cli/src/daemon/server.js';
import { DaemonStore } from '../../packages/cli/src/daemon/store.js';
import { parseSseChunk } from '../../packages/cli/src/utils/sse-parser.js';

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<{ status: number; data: T }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    data: await response.json() as T,
  };
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function openJsonSseStream(url: string): Promise<{
  next<T>(timeoutMs?: number): Promise<T>;
  close(): Promise<void>;
}> {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/event-stream',
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to open stream: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const queue: string[] = [];
  let carry = '';

  return {
    async next<T>(timeoutMs = 5_000): Promise<T> {
      const deadline = Date.now() + timeoutMs;

      while (queue.length === 0) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          throw new Error(`Timed out waiting for SSE event from ${url}`);
        }

        const result = await Promise.race([
          reader.read(),
          new Promise<{ timeout: true }>((resolve) => {
            setTimeout(() => resolve({ timeout: true }), remaining);
          }),
        ]);

        if ('timeout' in result) {
          throw new Error(`Timed out waiting for SSE event from ${url}`);
        }

        if (result.done) {
          throw new Error(`SSE stream closed before an event arrived: ${url}`);
        }

        const parsed = parseSseChunk(decoder.decode(result.value, { stream: true }), carry);
        carry = parsed.carry;
        queue.push(...parsed.events);
      }

      return JSON.parse(queue.shift()!) as T;
    },
    async close(): Promise<void> {
      await reader.cancel();
    },
  };
}

describe('AgentMeshDaemonServer UI', () => {
  let tempDir: string;
  let server: AgentMeshDaemonServer | null = null;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agent-mesh-daemon-ui-'));
  });

  afterEach(async () => {
    await server?.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('serves a local ui health endpoint', async () => {
    server = new AgentMeshDaemonServer({
      dbPath: join(tempDir, 'state.db'),
    });

    const address = await server.listenForTest();
    const response = await fetch(`${address.uiBaseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(address.uiPort).toBeGreaterThan(0);
  });

  it('routes daemon stop and restart actions through the local ui api', async () => {
    const stopHook = vi.fn();
    const restartHook = vi.fn();

    server = new AgentMeshDaemonServer({
      dbPath: join(tempDir, 'state.db'),
      uiControlHooks: {
        stop: stopHook,
        restart: restartHook,
      },
    });

    const address = await server.listenForTest();

    const stopped = await postJson<{ ok: boolean; action: string; uiBaseUrl: string | null }>(
      `${address.uiBaseUrl}/api/daemon/stop`,
      {},
    );
    const restarted = await postJson<{ ok: boolean; action: string; uiBaseUrl: string | null }>(
      `${address.uiBaseUrl}/api/daemon/restart`,
      {},
    );

    await Promise.resolve();

    expect(stopped.status).toBe(202);
    expect(stopped.data).toEqual({
      ok: true,
      action: 'stop',
      uiBaseUrl: address.uiBaseUrl,
    });
    expect(restarted.status).toBe(202);
    expect(restarted.data).toEqual({
      ok: true,
      action: 'restart',
      uiBaseUrl: address.uiBaseUrl,
    });
    expect(stopHook).toHaveBeenCalledTimes(1);
    expect(restartHook).toHaveBeenCalledTimes(1);
  });

  it('reuses the persisted ui port when the daemon starts again', async () => {
    const dbPath = join(tempDir, 'state.db');
    const preferredPort = await getFreePort();
    const store = new DaemonStore(dbPath);
    store.setDaemonSetting('ui.last_port', { value: preferredPort });
    store.close();

    server = new AgentMeshDaemonServer({ dbPath });
    const address = await server.listenForTest();

    expect(address.uiPort).toBe(preferredPort);
  });

  it('streams log updates through the local ui api', async () => {
    const dbPath = join(tempDir, 'state.db');
    const logPath = join(tempDir, 'daemon.log');

    server = new AgentMeshDaemonServer({
      dbPath,
      logPath,
      uiPort: 0,
    });

    const address = await server.listenForTest();
    const stream = await openJsonSseStream(`${address.uiBaseUrl}/api/logs/stream?lines=20`);

    const initial = await stream.next<{ items: string[]; path: string }>();
    appendFileSync(logPath, 'realtime log line\n');
    const updated = await stream.next<{ items: string[]; path: string }>();

    await stream.close();

    expect(initial).toEqual({
      items: [],
      path: logPath,
    });
    expect(updated.path).toBe(logPath);
    expect(updated.items.at(-1)).toBe('realtime log line');
  });
});

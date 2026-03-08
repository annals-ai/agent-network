import { readFileSync } from 'node:fs';
import { getDaemonLogPath } from '../daemon/paths.js';
import type { DaemonRuntime } from '../daemon/runtime.js';
import type { DaemonStore } from '../daemon/store.js';
import type { DaemonAgent, ProviderBinding, SessionRecord, TaskGroup } from '../daemon/types.js';
import type { UiHttpRequestHandler } from './http-server.js';

interface UiApiRoutesOptions {
  store: DaemonStore;
  runtime: DaemonRuntime;
  startedAt: string;
  getUiBaseUrl(): string | null;
  getUiPort(): number | null;
}

function writeJson(response: Parameters<UiHttpRequestHandler>[0]['response'], status: number, payload: unknown): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function splitPath(pathname: string): string[] {
  return pathname.split('/').filter(Boolean);
}

function clampLineCount(value: string | null): number {
  const parsed = Number.parseInt(value ?? '100', 10);
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(Math.max(parsed, 1), 1000);
}

function readLogTail(lines: number): string[] {
  try {
    return readFileSync(getDaemonLogPath(), 'utf-8')
      .split(/\r?\n/u)
      .filter(Boolean)
      .slice(-lines);
  } catch {
    return [];
  }
}

function serializeAgent(
  agent: DaemonAgent,
  bindings: ProviderBinding[],
  sessionCount: number,
): DaemonAgent & { bindings: ProviderBinding[]; sessionCount: number } {
  return {
    ...agent,
    bindings,
    sessionCount,
  };
}

function serializeTaskGroup(
  taskGroup: TaskGroup,
  sessionCount: number,
): TaskGroup & { sessionCount: number } {
  return {
    ...taskGroup,
    sessionCount,
  };
}

function serializeSession(
  session: SessionRecord,
  agent: DaemonAgent | null,
): SessionRecord & { agent: DaemonAgent | null } {
  return {
    ...session,
    agent,
  };
}

export function createUiApiHandler(options: UiApiRoutesOptions): UiHttpRequestHandler {
  return async ({ method, pathname, searchParams, response }) => {
    if (!pathname.startsWith('/api/')) {
      return false;
    }

    if (method !== 'GET') {
      writeJson(response, 405, { error: 'method_not_allowed' });
      return true;
    }

    const segments = splitPath(pathname);

    try {
      if (segments.length === 3 && segments[1] === 'daemon' && segments[2] === 'status') {
        const runtime = await options.runtime.getUiStatusSnapshot();
        writeJson(response, 200, {
          daemon: {
            pid: process.pid,
            startedAt: options.startedAt,
            uiBaseUrl: options.getUiBaseUrl(),
            uiPort: options.getUiPort(),
          },
          counts: {
            agents: options.store.listAgents().length,
            sessions: options.store.listSessions({ status: 'all' }).length,
            taskGroups: options.store.listTaskGroups().length,
            providerBindings: options.store.listProviderBindings().length,
          },
          runtime,
        });
        return true;
      }

      if (segments.length === 2 && segments[1] === 'agents') {
        const sessionCounts = options.store.getSessionCountsByAgent();
        const items = options.store.listAgents().map((agent) => serializeAgent(
          agent,
          options.store.listProviderBindings(agent.id),
          sessionCounts[agent.id] ?? 0,
        ));
        writeJson(response, 200, { items });
        return true;
      }

      if (segments.length === 3 && segments[1] === 'agents') {
        const agent = options.store.resolveAgentRef(segments[2]!);
        if (!agent) {
          writeJson(response, 404, { error: 'not_found', message: `Agent not found: ${segments[2]}` });
          return true;
        }

        writeJson(response, 200, {
          agent: serializeAgent(
            agent,
            options.store.listProviderBindings(agent.id),
            options.store.getSessionCountsByAgent()[agent.id] ?? 0,
          ),
          sessions: options.store.listSessions({ agentId: agent.id, status: 'all' }).map((session) => serializeSession(session, agent)),
        });
        return true;
      }

      if (segments.length === 2 && segments[1] === 'sessions') {
        const agentParam = searchParams.get('agent') ?? searchParams.get('agentId');
        const taskGroupId = searchParams.get('taskGroupId') ?? undefined;
        const status = searchParams.get('status') ?? 'all';
        const agent = agentParam ? options.store.resolveAgentRef(agentParam) : null;
        const items = options.store.listSessions({
          agentId: agent?.id,
          taskGroupId,
          status: status as SessionRecord['status'] | 'all',
        }).map((session) => serializeSession(session, options.store.getAgentById(session.agentId)));

        writeJson(response, 200, { items });
        return true;
      }

      if (segments.length === 3 && segments[1] === 'sessions') {
        const session = options.store.getSession(segments[2]!);
        if (!session) {
          writeJson(response, 404, { error: 'not_found', message: `Session not found: ${segments[2]}` });
          return true;
        }

        writeJson(response, 200, {
          session: serializeSession(session, options.store.getAgentById(session.agentId)),
        });
        return true;
      }

      if (segments.length === 4 && segments[1] === 'sessions' && segments[3] === 'messages') {
        const session = options.store.getSession(segments[2]!);
        if (!session) {
          writeJson(response, 404, { error: 'not_found', message: `Session not found: ${segments[2]}` });
          return true;
        }

        writeJson(response, 200, {
          items: options.store.getSessionMessages(session.id),
        });
        return true;
      }

      if (segments.length === 2 && segments[1] === 'tasks') {
        const sessionCounts = options.store.getSessionCountsByTaskGroup();
        const items = options.store.listTaskGroups().map((taskGroup) => serializeTaskGroup(
          taskGroup,
          sessionCounts[taskGroup.id] ?? 0,
        ));
        writeJson(response, 200, { items });
        return true;
      }

      if (segments.length === 3 && segments[1] === 'tasks') {
        const taskGroup = options.store.getTaskGroup(segments[2]!);
        if (!taskGroup) {
          writeJson(response, 404, { error: 'not_found', message: `Task group not found: ${segments[2]}` });
          return true;
        }

        writeJson(response, 200, {
          taskGroup: serializeTaskGroup(
            taskGroup,
            options.store.getSessionCountsByTaskGroup()[taskGroup.id] ?? 0,
          ),
          sessions: options.store.listSessions({ taskGroupId: taskGroup.id, status: 'all' }).map((session) => (
            serializeSession(session, options.store.getAgentById(session.agentId))
          )),
        });
        return true;
      }

      if (segments.length === 2 && segments[1] === 'providers') {
        const items = options.store.listProviderBindings().map((binding) => ({
          ...binding,
          agent: options.store.getAgentById(binding.agentId),
        }));
        writeJson(response, 200, { items });
        return true;
      }

      if (segments.length === 2 && segments[1] === 'logs') {
        writeJson(response, 200, {
          items: readLogTail(clampLineCount(searchParams.get('lines'))),
          path: getDaemonLogPath(),
        });
        return true;
      }

      writeJson(response, 404, { error: 'not_found' });
      return true;
    } catch (error) {
      writeJson(response, 500, {
        error: 'internal_error',
        message: (error as Error).message,
      });
      return true;
    }
  };
}

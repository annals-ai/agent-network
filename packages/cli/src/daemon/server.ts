import { createServer, type Socket } from 'node:net';
import { createInterface } from 'node:readline';
import { unlinkSync } from 'node:fs';
import { DaemonRuntime } from './runtime.js';
import { getDaemonSocketPath } from './paths.js';
import { DaemonStore } from './store.js';
import type { DaemonEnvelope, DaemonRequest } from './protocol.js';
import { getProvider, shutdownProviders } from '../providers/index.js';
import { log } from '../utils/logger.js';

function respond(socket: Socket, payload: DaemonEnvelope): void {
  socket.write(JSON.stringify(payload) + '\n');
}

function expectString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export class AgentMeshDaemonServer {
  private readonly store = new DaemonStore();
  private readonly runtime = new DaemonRuntime(this.store);
  private readonly startedAt = new Date().toISOString();
  private shuttingDown = false;

  async listen(socketPath = getDaemonSocketPath()): Promise<void> {
    try {
      unlinkSync(socketPath);
    } catch {}

    const server = createServer((socket) => {
      const rl = createInterface({ input: socket });

      rl.on('line', (line) => {
        void this.handleLine(socket, line);
      });
    });

    const shutdown = () => {
      if (this.shuttingDown) return;
      this.shuttingDown = true;
      server.close(() => {
        void shutdownProviders()
          .catch((error) => {
            log.warn(`Failed to stop provider ingress cleanly: ${error}`);
          })
          .finally(() => {
            this.store.close();
            try {
              unlinkSync(socketPath);
            } catch {}
            process.exit(0);
          });
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(socketPath, () => resolve());
    });

    log.info(`agent-mesh daemon listening on ${socketPath}`);
    void this.restoreProviderIngresses();
  }

  private async handleLine(socket: Socket, line: string): Promise<void> {
    let request: DaemonRequest;
    try {
      request = JSON.parse(line) as DaemonRequest;
    } catch {
      return;
    }

    try {
      const result = await this.dispatchRequest(request, (event) => {
        respond(socket, {
          id: request.id,
          type: 'event',
          event,
        });
      });

      respond(socket, {
        id: request.id,
        type: 'result',
        result,
      });
    } catch (error) {
      respond(socket, {
        id: request.id,
        type: 'error',
        error: {
          code: 'daemon_error',
          message: (error as Error).message,
        },
      });
    }
  }

  private async dispatchRequest(request: DaemonRequest, emit: (event: unknown) => void): Promise<unknown> {
    switch (request.method) {
      case 'ping':
        return {
          ok: true,
          pid: process.pid,
          startedAt: this.startedAt,
        };

      case 'daemon.status':
        return {
          pid: process.pid,
          startedAt: this.startedAt,
          agents: this.store.listAgents().length,
          sessions: this.store.listSessions({ status: 'all' }).length,
          taskGroups: this.store.listTaskGroups().length,
          providerBindings: this.store.listProviderBindings().length,
          onlineBindings: this.store.listProviderBindings().filter((binding) => binding.status === 'online').length,
        };

      case 'agent.list':
        return {
          agents: this.store.listAgents(),
          bindings: this.store.listProviderBindings(),
        };

      case 'agent.get': {
        const ref = expectString(request.params?.ref, 'ref');
        const agent = this.store.resolveAgentRef(ref);
        if (!agent) throw new Error(`Local agent not found: ${ref}`);
        return {
          agent,
          bindings: this.store.listProviderBindings(agent.id),
        };
      }

      case 'agent.add': {
        const agent = this.store.createAgent({
          name: expectString(request.params?.name, 'name'),
          slug: typeof request.params?.slug === 'string' ? request.params.slug : undefined,
          runtimeType: typeof request.params?.runtimeType === 'string' ? request.params.runtimeType : 'claude',
          projectPath: expectString(request.params?.projectPath, 'projectPath'),
          sandbox: request.params?.sandbox === true,
          description: typeof request.params?.description === 'string' ? request.params.description : null,
          capabilities: Array.isArray(request.params?.capabilities)
            ? request.params?.capabilities.map((item) => String(item))
            : [],
          visibility: typeof request.params?.visibility === 'string'
            ? request.params.visibility as 'public' | 'private' | 'unlisted'
            : 'private',
        });
        return { agent };
      }

      case 'agent.update': {
        const ref = expectString(request.params?.ref, 'ref');
        const current = this.store.resolveAgentRef(ref);
        if (!current) throw new Error(`Local agent not found: ${ref}`);
        const agent = this.store.updateAgent(current.id, {
          slug: typeof request.params?.slug === 'string' ? request.params.slug : undefined,
          name: typeof request.params?.name === 'string' ? request.params.name : undefined,
          runtimeType: typeof request.params?.runtimeType === 'string' ? request.params.runtimeType : undefined,
          projectPath: typeof request.params?.projectPath === 'string' ? request.params.projectPath : undefined,
          sandbox: typeof request.params?.sandbox === 'boolean' ? request.params.sandbox : undefined,
          description: typeof request.params?.description === 'string' ? request.params.description : undefined,
          capabilities: Array.isArray(request.params?.capabilities)
            ? request.params.capabilities.map((item) => String(item))
            : undefined,
          visibility: typeof request.params?.visibility === 'string'
            ? request.params.visibility as 'public' | 'private' | 'unlisted'
            : undefined,
        });
        for (const binding of this.store.listProviderBindings(agent.id)) {
          if (binding.status === 'inactive') continue;
          const provider = getProvider(binding.provider);
          await provider.startIngress({ agent, binding, store: this.store, runtime: this.runtime });
        }
        return { agent };
      }

      case 'agent.remove': {
        const ref = expectString(request.params?.ref, 'ref');
        const agent = this.store.resolveAgentRef(ref);
        if (!agent) throw new Error(`Local agent not found: ${ref}`);
        for (const binding of this.store.listProviderBindings(agent.id)) {
          const provider = getProvider(binding.provider);
          await provider.stopIngress({ agent, binding, store: this.store, runtime: this.runtime });
        }
        this.store.removeAgent(agent.id);
        return { ok: true, agentId: agent.id };
      }

      case 'agent.expose': {
        const ref = expectString(request.params?.ref, 'ref');
        const providerName = expectString(request.params?.provider, 'provider');
        const agent = this.store.resolveAgentRef(ref);
        if (!agent) throw new Error(`Local agent not found: ${ref}`);
        const provider = getProvider(providerName);
        const current = this.store.getProviderBinding(agent.id, providerName);
        const result = current
          ? await provider.updateAgent({ agent, binding: current, store: this.store })
          : await provider.registerAgent({ agent, binding: current, store: this.store });

        const binding = this.store.upsertProviderBinding({
          agentId: agent.id,
          provider: providerName,
          remoteAgentId: result.remoteAgentId ?? current?.remoteAgentId ?? null,
          remoteSlug: result.remoteSlug ?? current?.remoteSlug ?? null,
          status: result.status,
          config: {
            ...(current?.config ?? {}),
            ...(typeof request.params?.config === 'object' && request.params?.config ? request.params.config as Record<string, unknown> : {}),
            ...(result.config ?? {}),
          },
          lastSyncedAt: result.lastSyncedAt ?? new Date().toISOString(),
        });

        try {
          await provider.startIngress({ agent, binding, store: this.store, runtime: this.runtime });
        } catch (error) {
          const failed = this.store.upsertProviderBinding({
            agentId: agent.id,
            provider: providerName,
            remoteAgentId: binding.remoteAgentId,
            remoteSlug: binding.remoteSlug,
            status: 'error',
            config: binding.config,
            lastSyncedAt: new Date().toISOString(),
          });
          throw new Error(`${(error as Error).message} (binding status: ${failed.status})`);
        }

        return {
          agent,
          binding: this.store.getProviderBinding(agent.id, providerName) ?? binding,
        };
      }

      case 'agent.unexpose': {
        const ref = expectString(request.params?.ref, 'ref');
        const providerName = expectString(request.params?.provider, 'provider');
        const agent = this.store.resolveAgentRef(ref);
        if (!agent) throw new Error(`Local agent not found: ${ref}`);
        const binding = this.store.getProviderBinding(agent.id, providerName);
        if (!binding) throw new Error(`Provider binding not found: ${providerName}`);
        const provider = getProvider(providerName);
        await provider.stopIngress({ agent, binding, store: this.store, runtime: this.runtime });
        await provider.unregisterAgent({ agent, binding, store: this.store });
        const nextBinding = this.store.upsertProviderBinding({
          agentId: agent.id,
          provider: providerName,
          remoteAgentId: binding.remoteAgentId,
          remoteSlug: binding.remoteSlug,
          status: 'inactive',
          config: binding.config,
          lastSyncedAt: new Date().toISOString(),
        });
        return { agent, binding: nextBinding };
      }

      case 'task.create': {
        const taskGroup = this.store.createTaskGroup({
          title: expectString(request.params?.title, 'title'),
          ownerPrincipal: typeof request.params?.ownerPrincipal === 'string' ? request.params.ownerPrincipal : 'owner:local',
          source: typeof request.params?.source === 'string' ? request.params.source : 'cli',
          status: typeof request.params?.status === 'string' ? request.params.status : 'active',
          metadata: typeof request.params?.metadata === 'object' && request.params?.metadata
            ? request.params.metadata as Record<string, unknown>
            : {},
        });
        return { taskGroup };
      }

      case 'task.list':
        return { taskGroups: this.store.listTaskGroups() };

      case 'task.show': {
        const id = expectString(request.params?.id, 'id');
        const taskGroup = this.store.getTaskGroup(id);
        if (!taskGroup) throw new Error(`Task group not found: ${id}`);
        return {
          taskGroup,
          sessions: this.store.listSessions({ taskGroupId: id, status: 'all' }),
        };
      }

      case 'task.archive': {
        const id = expectString(request.params?.id, 'id');
        return { taskGroup: this.store.archiveTaskGroup(id) };
      }

      case 'session.list': {
        let agentId: string | undefined;
        if (typeof request.params?.agentRef === 'string' && request.params.agentRef.trim()) {
          const agent = this.store.resolveAgentRef(request.params.agentRef);
          if (!agent) throw new Error(`Local agent not found: ${request.params.agentRef}`);
          agentId = agent.id;
        }
        return {
          sessions: this.store.listSessions({
            agentId,
            taskGroupId: typeof request.params?.taskGroupId === 'string' ? request.params.taskGroupId : undefined,
            status: typeof request.params?.status === 'string'
              ? request.params.status as 'queued' | 'active' | 'idle' | 'paused' | 'completed' | 'failed' | 'archived' | 'all'
              : 'all',
          }),
        };
      }

      case 'session.show': {
        const id = expectString(request.params?.id, 'id');
        const session = this.store.getSession(id);
        if (!session) throw new Error(`Session not found: ${id}`);
        const agent = this.store.getAgentById(session.agentId);
        return {
          session,
          agent,
          messages: this.store.getSessionMessages(id),
        };
      }

      case 'session.attach': {
        const id = expectString(request.params?.id, 'id');
        const session = this.store.getSession(id);
        if (!session) throw new Error(`Session not found: ${id}`);
        const agent = this.store.getAgentById(session.agentId);
        return {
          session,
          agent,
          messages: this.store.getSessionMessages(id),
        };
      }

      case 'session.fork': {
        const id = expectString(request.params?.id, 'id');
        const session = this.store.forkSession({
          sourceSessionId: id,
          taskGroupId: typeof request.params?.taskGroupId === 'string' ? request.params.taskGroupId : undefined,
          title: typeof request.params?.title === 'string' ? request.params.title : undefined,
          tags: normalizeTags(request.params?.tags),
        });
        return {
          session,
          messages: this.store.getSessionMessages(session.id),
        };
      }

      case 'session.stop': {
        const id = expectString(request.params?.id, 'id');
        return { session: this.runtime.stopSession(id) };
      }

      case 'session.archive': {
        const id = expectString(request.params?.id, 'id');
        const session = this.store.archiveSession(id);
        await this.runtime.syncSessionToPlatform(id);
        return { session };
      }

      case 'runtime.chat':
      case 'runtime.call': {
        const result = await this.runtime.execute({
          agentRef: typeof request.params?.agentRef === 'string' ? request.params.agentRef : undefined,
          sessionId: typeof request.params?.sessionId === 'string' ? request.params.sessionId : undefined,
          forkFromSessionId: typeof request.params?.forkFromSessionId === 'string' ? request.params.forkFromSessionId : undefined,
          message: expectString(request.params?.message, 'message'),
          mode: request.method === 'runtime.chat' ? 'chat' : 'call',
          taskGroupId: typeof request.params?.taskGroupId === 'string' ? request.params.taskGroupId : undefined,
          title: typeof request.params?.title === 'string' ? request.params.title : undefined,
          tags: normalizeTags(request.params?.tags),
          principalType: 'owner_local',
          principalId: 'owner',
          withFiles: request.params?.withFiles === true,
        }, emit);
        return {
          ...result,
          completion: result.completion
            ? {
              attachments: result.completion.attachments,
              fileTransferOffer: result.completion.fileTransferOffer,
            }
            : undefined,
        };
      }

      default:
        throw new Error(`Unknown daemon method: ${request.method}`);
    }
  }

  private async restoreProviderIngresses(): Promise<void> {
    for (const binding of this.store.listProviderBindings()) {
      if (binding.status === 'inactive') continue;
      const agent = this.store.getAgentById(binding.agentId);
      if (!agent) continue;

      try {
        const provider = getProvider(binding.provider);
        await provider.startIngress({ agent, binding, store: this.store, runtime: this.runtime });
      } catch (error) {
        this.store.upsertProviderBinding({
          agentId: binding.agentId,
          provider: binding.provider,
          remoteAgentId: binding.remoteAgentId,
          remoteSlug: binding.remoteSlug,
          status: 'error',
          config: binding.config,
          lastSyncedAt: new Date().toISOString(),
        });
        log.warn(`Failed to restore ${binding.provider} ingress for ${agent.slug}: ${(error as Error).message}`);
      }
    }
  }
}

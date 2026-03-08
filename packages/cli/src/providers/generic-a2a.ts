import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { DaemonRuntime } from '../daemon/runtime.js';
import type { DaemonStore } from '../daemon/store.js';
import type { DaemonAgent, ProviderBinding, ProviderExposureResult, SessionMessage, SessionRecord } from '../daemon/types.js';

const A2A_PROTOCOL_VERSION = '1.0';

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

interface GenericA2AConfig {
  host: string;
  port: number;
  publicBaseUrl: string | null;
  bearerToken: string | null;
}

interface GenericA2AContext {
  agent: DaemonAgent;
  binding: ProviderBinding;
  store: DaemonStore;
  runtime: DaemonRuntime;
}

interface ActiveGenericIngress {
  server: Server;
  config: GenericA2AConfig;
}

type A2AMessagePart =
  | { type: 'text'; text: string }
  | { type: 'json'; value: unknown }
  | { type: 'file'; name: string; mimeType?: string; uri?: string };

function normalizePublicBaseUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
}

function normalizePort(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 65535) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 65535) {
      return parsed;
    }
  }
  return 0;
}

function normalizeHost(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return '127.0.0.1';
}

function normalizeConfig(raw: Record<string, unknown>): GenericA2AConfig {
  return {
    host: normalizeHost(raw.host),
    port: normalizePort(raw.port),
    publicBaseUrl: normalizePublicBaseUrl(raw.publicBaseUrl),
    bearerToken: typeof raw.bearerToken === 'string' && raw.bearerToken.trim()
      ? raw.bearerToken.trim()
      : null,
  };
}

function resolveOrigin(config: GenericA2AConfig, port: number): string {
  if (config.publicBaseUrl) {
    return config.publicBaseUrl;
  }

  const host = config.host === '0.0.0.0' ? '127.0.0.1' : config.host;
  return `http://${host}:${port}`;
}

function capabilityToSkill(capability: string): { id: string; name: string; description: string; tags: string[] } {
  return {
    id: capability,
    name: capability,
    description: capability,
    tags: [capability],
  };
}

function buildAgentCard(agent: DaemonAgent, origin: string, requiresAuth: boolean): Record<string, unknown> {
  const jsonrpcUrl = `${origin}/jsonrpc`;
  return {
    name: agent.name,
    description: agent.description || '',
    version: A2A_PROTOCOL_VERSION,
    url: jsonrpcUrl,
    preferredTransport: 'JSONRPC',
    supportedInterfaces: [{
      protocolBinding: 'JSONRPC',
      protocolVersion: A2A_PROTOCOL_VERSION,
      url: jsonrpcUrl,
    }],
    capabilities: {
      streaming: false,
      async: true,
      pushNotifications: false,
      fileTransfer: false,
    },
    securitySchemes: requiresAuth
      ? {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'opaque token',
          },
        }
      : {},
    securityRequirements: requiresAuth ? [{ bearerAuth: [] }] : [],
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['text/plain', 'application/json'],
    skills: agent.capabilities.map(capabilityToSkill),
  };
}

function buildExtendedAgentCard(agent: DaemonAgent, origin: string, requiresAuth: boolean): Record<string, unknown> {
  return {
    ...buildAgentCard(agent, origin, requiresAuth),
    metadata: {
      authorLogin: 'local-daemon',
      authorName: 'Local Daemon',
      visibility: agent.visibility === 'public' ? 'public' : 'private',
      isOnline: true,
    },
  };
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('Request body too large.'));
      }
    });
    request.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
    request.on('error', reject);
  });
}

function respondJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'A2A-Version': A2A_PROTOCOL_VERSION,
  });
  response.end(JSON.stringify(body));
}

function respondJsonRpcSuccess(response: ServerResponse, id: JsonRpcId, result: unknown): void {
  respondJson(response, 200, {
    jsonrpc: '2.0',
    id,
    result,
  });
}

function respondJsonRpcError(
  response: ServerResponse,
  id: JsonRpcId,
  statusCode: number,
  code: number,
  message: string,
  data?: Record<string, unknown>,
): void {
  respondJson(response, statusCode, {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data ? { data } : {}),
    },
  });
}

function requireAuth(request: IncomingMessage, token: string | null): boolean {
  if (!token) return true;
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return false;
  return header.slice('Bearer '.length) === token;
}

function roleToA2ARole(role: string): 'user' | 'agent' | 'system' {
  if (role === 'assistant') return 'agent';
  if (role === 'system') return 'system';
  return 'user';
}

function textFromParts(parts: A2AMessagePart[]): string {
  const chunks: string[] = [];
  for (const part of parts) {
    if (part.type === 'text') chunks.push(part.text);
    else if (part.type === 'json') chunks.push(JSON.stringify(part.value));
    else chunks.push(part.uri ? `${part.name}: ${part.uri}` : part.name);
  }
  return chunks.map((chunk) => chunk.trim()).filter(Boolean).join('\n').trim();
}

function parseMessageParts(params: Record<string, unknown>): { contextId: string; messageText: string; parts: A2AMessagePart[] } {
  const contextId = typeof params.contextId === 'string' && params.contextId.trim()
    ? params.contextId.trim()
    : randomUUID();

  const messageCandidate = (params.message || params.input) as Record<string, unknown> | undefined;
  if (!messageCandidate || !Array.isArray(messageCandidate.parts) || messageCandidate.parts.length === 0) {
    throw new Error('`params.message.parts` is required.');
  }

  const parts = messageCandidate.parts.map((part) => {
    if (!part || typeof part !== 'object') {
      return { type: 'text', text: '' } as A2AMessagePart;
    }
    const typed = part as Record<string, unknown>;
    if (typed.type === 'json') {
      return { type: 'json', value: typed.value } as A2AMessagePart;
    }
    if (typed.type === 'file') {
      return {
        type: 'file',
        name: typeof typed.name === 'string' ? typed.name : 'file',
        ...(typeof typed.mimeType === 'string' ? { mimeType: typed.mimeType } : {}),
        ...(typeof typed.uri === 'string' ? { uri: typed.uri } : {}),
      } as A2AMessagePart;
    }
    return {
      type: 'text',
      text: typeof typed.text === 'string' ? typed.text : '',
    } as A2AMessagePart;
  });

  const messageText = textFromParts(parts);
  if (!messageText) {
    throw new Error('Message text is empty.');
  }

  return { contextId, messageText, parts };
}

function mapTaskState(status: SessionRecord['status']): string {
  switch (status) {
    case 'queued':
      return 'TASK_STATE_SUBMITTED';
    case 'active':
      return 'TASK_STATE_WORKING';
    case 'failed':
      return 'TASK_STATE_FAILED';
    case 'paused':
    case 'archived':
      return 'TASK_STATE_CANCELED';
    default:
      return 'TASK_STATE_COMPLETED';
  }
}

function mapMessages(messages: SessionMessage[]): Array<Record<string, unknown>> {
  return messages.map((message) => ({
    messageId: message.id,
    role: roleToA2ARole(message.role),
    parts: [{ type: 'text', text: message.content }],
    ...(Object.keys(message.metadata).length > 0 ? { metadata: message.metadata } : {}),
  }));
}

function buildTask(session: SessionRecord, messages: SessionMessage[]): Record<string, unknown> {
  return {
    id: session.id,
    contextId: session.id,
    state: mapTaskState(session.status),
    agentId: session.agentId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: mapMessages(messages),
    metadata: {
      origin: session.origin,
      principalType: session.principalType,
      ...(session.taskGroupId ? { taskGroupId: session.taskGroupId } : {}),
      ...(session.tags.length ? { tags: session.tags } : {}),
    },
  };
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function listenServer(server: Server, host: string, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address() as AddressInfo | null;
      if (!address) {
        reject(new Error('Generic A2A ingress did not bind to a port.'));
        return;
      }
      resolve(address.port);
    });
  });
}

function taskIdFromParams(params: Record<string, unknown>): string {
  if (typeof params.taskId === 'string' && params.taskId.trim()) {
    return params.taskId.trim();
  }
  if (typeof params.contextId === 'string' && params.contextId.trim()) {
    return params.contextId.trim();
  }
  throw new Error('`params.taskId` is required.');
}

export class GenericA2AProvider {
  readonly name = 'generic-a2a';
  private readonly activeIngresses = new Map<string, ActiveGenericIngress>();

  async registerAgent(input: { agent: DaemonAgent; binding: ProviderBinding | null }): Promise<ProviderExposureResult> {
    return {
      remoteAgentId: input.binding?.remoteAgentId ?? null,
      remoteSlug: input.binding?.remoteSlug ?? input.agent.slug,
      status: 'configured',
      config: input.binding?.config ?? {},
      lastSyncedAt: new Date().toISOString(),
    };
  }

  async updateAgent(input: { agent: DaemonAgent; binding: ProviderBinding }): Promise<ProviderExposureResult> {
    return {
      remoteAgentId: input.binding.remoteAgentId,
      remoteSlug: input.binding.remoteSlug ?? input.agent.slug,
      status: 'configured',
      config: input.binding.config,
      lastSyncedAt: new Date().toISOString(),
    };
  }

  async unregisterAgent(): Promise<void> {}

  async startIngress(input: GenericA2AContext): Promise<void> {
    const { agent, binding, store, runtime } = input;
    const config = normalizeConfig(binding.config);

    if (agent.visibility !== 'public' && !config.bearerToken) {
      throw new Error('generic-a2a private exposures require `bearerToken` in --config-json.');
    }

    const existing = this.activeIngresses.get(agent.id);
    if (existing) {
      await closeServer(existing.server).catch(() => undefined);
      this.activeIngresses.delete(agent.id);
    }

    const server = createServer((request, response) => {
      const liveConfig = this.activeIngresses.get(agent.id)?.config ?? config;
      void this.handleRequest({ request, response, agent, binding, store, runtime, config: liveConfig });
    });

    const port = await listenServer(server, config.host, config.port);
    const origin = resolveOrigin(config, port);
    const nextConfig = {
      ...binding.config,
      host: config.host,
      port,
      publicBaseUrl: config.publicBaseUrl,
      ...(config.bearerToken ? { bearerToken: config.bearerToken } : {}),
      baseUrl: origin,
      jsonrpcUrl: `${origin}/jsonrpc`,
      cardUrl: `${origin}/.well-known/agent-card.json`,
      extendedCardUrl: `${origin}/extended-agent-card`,
      healthUrl: `${origin}/health`,
    };

    store.upsertProviderBinding({
      agentId: agent.id,
      provider: binding.provider,
      remoteAgentId: `${origin}/jsonrpc`,
      remoteSlug: agent.slug,
      status: 'online',
      config: nextConfig,
      lastSyncedAt: new Date().toISOString(),
    });

    this.activeIngresses.set(agent.id, {
      server,
      config: {
        ...config,
        port,
      },
    });
  }

  async stopIngress(input: GenericA2AContext): Promise<void> {
    const active = this.activeIngresses.get(input.agent.id);
    if (!active) return;
    await closeServer(active.server).catch(() => undefined);
    this.activeIngresses.delete(input.agent.id);
  }

  async deliverInboundRequest(): Promise<never> {
    throw new Error('Generic A2A inbound delivery is handled by the daemon HTTP ingress.');
  }

  async syncSessionState(): Promise<void> {}

  async streamResponse(): Promise<never> {
    throw new Error('Generic A2A streaming responses are not implemented yet.');
  }

  async shutdown(): Promise<void> {
    for (const [agentId, ingress] of this.activeIngresses.entries()) {
      await closeServer(ingress.server).catch(() => undefined);
      this.activeIngresses.delete(agentId);
    }
  }

  private async handleRequest(input: {
    request: IncomingMessage;
    response: ServerResponse;
    agent: DaemonAgent;
    binding: ProviderBinding;
    store: DaemonStore;
    runtime: DaemonRuntime;
    config: GenericA2AConfig;
  }): Promise<void> {
    const { request, response, agent, store, runtime, config } = input;
    const origin = resolveOrigin(config, config.port);
    const requiresAuth = !!config.bearerToken;
    const pathname = new URL(request.url ?? '/', origin).pathname;

    if (!requireAuth(request, config.bearerToken)) {
      if (pathname === '/jsonrpc') {
        respondJsonRpcError(response, null, 401, -32001, 'Unauthorized');
        return;
      }
      respondJson(response, 401, { error: 'unauthorized' });
      return;
    }

    if (request.method === 'GET' && pathname === '/health') {
      respondJson(response, 200, {
        ok: true,
        agent: agent.slug,
        provider: 'generic-a2a',
      });
      return;
    }

    if (request.method === 'GET' && (pathname === '/.well-known/agent-card.json' || pathname === '/card')) {
      respondJson(response, 200, buildAgentCard(agent, origin, requiresAuth));
      return;
    }

    if (request.method === 'GET' && pathname === '/extended-agent-card') {
      respondJson(response, 200, buildExtendedAgentCard(agent, origin, requiresAuth));
      return;
    }

    if (request.method !== 'POST' || pathname !== '/jsonrpc') {
      respondJson(response, 404, { error: 'not_found' });
      return;
    }

    let rpc: JsonRpcRequest;
    try {
      const body = await readJsonBody(request);
      rpc = body as JsonRpcRequest;
    } catch (error) {
      respondJsonRpcError(response, null, 400, -32700, (error as Error).message);
      return;
    }

    const rpcId = rpc.id ?? null;
    if (rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') {
      respondJsonRpcError(response, rpcId, 400, -32600, 'Invalid JSON-RPC request.');
      return;
    }

    const params = rpc.params ?? {};

    try {
      if (rpc.method === 'GetExtendedAgentCard') {
        respondJsonRpcSuccess(response, rpcId, { card: buildExtendedAgentCard(agent, origin, requiresAuth) });
        return;
      }

      if (rpc.method === 'SendMessage') {
        const parsed = parseMessageParts(params);
        const existing = store.getSession(parsed.contextId);
        if (existing && existing.agentId !== agent.id) {
          throw new Error('Task not found.');
        }

        const principalId = config.bearerToken ? 'generic-a2a:bearer' : 'generic-a2a:anonymous';
        const result = await runtime.execute({
          agentRef: agent.slug,
          sessionId: parsed.contextId,
          createIfMissing: true,
          message: parsed.messageText,
          mode: 'call',
          title: `A2A task: ${parsed.messageText.slice(0, 50)}`,
          origin: 'generic_a2a',
          principalType: 'generic_a2a',
          principalId,
        }, () => undefined);

        const session = store.getSession(result.session.id);
        if (!session) {
          throw new Error('Task not found.');
        }

        respondJsonRpcSuccess(response, rpcId, {
          task: buildTask(session, store.getSessionMessages(session.id)),
        });
        return;
      }

      if (rpc.method === 'GetTask') {
        const taskId = taskIdFromParams(params);
        const session = store.getSession(taskId);
        if (!session || session.agentId !== agent.id) {
          throw new Error('Task not found.');
        }

        respondJsonRpcSuccess(response, rpcId, {
          task: buildTask(session, store.getSessionMessages(session.id)),
        });
        return;
      }

      if (rpc.method === 'ListTasks') {
        const tasks = store
          .listSessions({ agentId: agent.id, status: 'all' })
          .filter((session) => session.origin === 'generic_a2a')
          .map((session) => buildTask(session, store.getSessionMessages(session.id)));

        respondJsonRpcSuccess(response, rpcId, { tasks });
        return;
      }

      if (rpc.method === 'CancelTask') {
        const taskId = taskIdFromParams(params);
        const session = store.getSession(taskId);
        if (!session || session.agentId !== agent.id) {
          throw new Error('Task not found.');
        }

        const stopped = runtime.stopSession(taskId);
        respondJsonRpcSuccess(response, rpcId, {
          task: buildTask(stopped, store.getSessionMessages(stopped.id)),
        });
        return;
      }

      if (rpc.method === 'SendStreamingMessage') {
        respondJsonRpcError(response, rpcId, 501, -32601, 'SendStreamingMessage is not implemented yet.');
        return;
      }

      respondJsonRpcError(response, rpcId, 404, -32601, `Method not found: ${rpc.method}`);
    } catch (error) {
      const message = (error as Error).message || 'Internal error.';
      const statusCode = message === 'Task not found.' ? 404 : 500;
      respondJsonRpcError(response, rpcId, statusCode, statusCode === 404 ? -32004 : -32603, message);
    }
  }
}

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

type A2APart =
  | { text: string; metadata?: Record<string, unknown>; filename?: string; mediaType?: string }
  | { raw: string; metadata?: Record<string, unknown>; filename?: string; mediaType?: string }
  | { url: string; metadata?: Record<string, unknown>; filename?: string; mediaType?: string }
  | { data: unknown; metadata?: Record<string, unknown>; filename?: string; mediaType?: string };

type ProviderJsonRpcError = Error & {
  statusCode: number;
  code: number;
  reason: string;
  metadata?: Record<string, unknown>;
};

function makeProviderError(
  statusCode: number,
  code: number,
  message: string,
  reason: string,
  metadata?: Record<string, unknown>,
): ProviderJsonRpcError {
  const error = new Error(message) as ProviderJsonRpcError;
  error.statusCode = statusCode;
  error.code = code;
  error.reason = reason;
  error.metadata = metadata;
  return error;
}

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
    supportedInterfaces: [{
      url: jsonrpcUrl,
      protocolBinding: 'JSONRPC',
      protocolVersion: A2A_PROTOCOL_VERSION,
    }],
    provider: {
      url: origin,
      organization: 'Local Daemon',
    },
    version: '1.0.0',
    capabilities: {
      streaming: true,
      pushNotifications: false,
      extendedAgentCard: true,
    },
    securitySchemes: requiresAuth
      ? {
          bearerAuth: {
            httpAuthSecurityScheme: {
              scheme: 'Bearer',
              bearerFormat: 'opaque token',
            },
          },
        }
      : {},
    securityRequirements: requiresAuth ? [{ schemes: { bearerAuth: { list: [] } } }] : [],
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['text/plain', 'application/json'],
    skills: agent.capabilities.map(capabilityToSkill),
  };
}

function buildExtendedAgentCard(agent: DaemonAgent, origin: string, requiresAuth: boolean): Record<string, unknown> {
  return buildAgentCard(agent, origin, requiresAuth);
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
  data?: { reason: string; metadata?: Record<string, unknown> },
): void {
  const details = data
    ? [{
        '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
        reason: data.reason,
        domain: 'a2a-protocol.org',
        ...(data.metadata ? { metadata: Object.fromEntries(
          Object.entries(data.metadata).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])
        ) } : {}),
      }]
    : undefined;
  respondJson(response, statusCode, {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(details ? { data: details } : {}),
    },
  });
}

function requireAuth(request: IncomingMessage, token: string | null): boolean {
  if (!token) return true;
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return false;
  return header.slice('Bearer '.length) === token;
}

function roleToA2ARole(role: string): 'ROLE_USER' | 'ROLE_AGENT' {
  return role === 'user' ? 'ROLE_USER' : 'ROLE_AGENT';
}

function normalizePart(part: unknown): A2APart {
  if (!part || typeof part !== 'object') return { text: '' };
  const typed = part as Record<string, unknown>;
  if (typeof typed.text === 'string') return { text: typed.text };
  if (typeof typed.raw === 'string') return { raw: typed.raw };
  if (typeof typed.url === 'string') {
    return {
      url: typed.url,
      ...(typeof typed.filename === 'string' ? { filename: typed.filename } : {}),
      ...(typeof typed.mediaType === 'string' ? { mediaType: typed.mediaType } : {}),
    };
  }
  if ('data' in typed) return { data: typed.data };
  if (typed.type === 'json') return { data: typed.value };
  if (typed.type === 'file') {
    return {
      url: typeof typed.uri === 'string' ? typed.uri : '',
      ...(typeof typed.name === 'string' ? { filename: typed.name } : {}),
      ...(typeof typed.mimeType === 'string' ? { mediaType: typed.mimeType } : {}),
    };
  }
  return { text: typeof typed.text === 'string' ? typed.text : '' };
}

function textFromParts(parts: A2APart[]): string {
  const chunks: string[] = [];
  for (const part of parts) {
    if ('text' in part) chunks.push(part.text);
    else if ('data' in part) chunks.push(JSON.stringify(part.data));
    else if ('url' in part) chunks.push(part.filename ? `${part.filename}: ${part.url}` : part.url);
    else chunks.push(part.filename || '[binary]');
  }
  return chunks.map((chunk) => chunk.trim()).filter(Boolean).join('\n').trim();
}

function assertSupportedInboundParts(parts: A2APart[]): void {
  for (const part of parts) {
    if ('url' in part || 'raw' in part) {
      throw makeProviderError(
        415,
        -32005,
        'Content type not supported',
        'CONTENT_TYPE_NOT_SUPPORTED',
        {
          partType: 'url' in part ? 'url' : 'raw',
          mediaType: part.mediaType || 'application/octet-stream',
        },
      );
    }
  }
}

function parseMessageParts(params: Record<string, unknown>): {
  contextId: string;
  messageText: string;
  parts: A2APart[];
  historyLength?: number;
  returnImmediately: boolean;
} {
  const messageCandidate = (params.message || params.input) as Record<string, unknown> | undefined;
  if (!messageCandidate || !Array.isArray(messageCandidate.parts) || messageCandidate.parts.length === 0) {
    throw new Error('`params.message.parts` is required.');
  }

  const contextId = typeof messageCandidate.contextId === 'string' && messageCandidate.contextId.trim()
    ? messageCandidate.contextId.trim()
    : typeof params.contextId === 'string' && params.contextId.trim()
      ? params.contextId.trim()
      : randomUUID();

  const parts = messageCandidate.parts.map((part) => normalizePart(part));
  assertSupportedInboundParts(parts);

  const messageText = textFromParts(parts);
  if (!messageText) {
    throw new Error('Message text is empty.');
  }

  const configuration = params.configuration && typeof params.configuration === 'object'
    ? params.configuration as Record<string, unknown>
    : undefined;

  return {
    contextId,
    messageText,
    parts,
    ...(typeof configuration?.historyLength === 'number'
      ? { historyLength: Math.max(0, Math.floor(configuration.historyLength)) }
      : {}),
    returnImmediately: configuration?.returnImmediately === true,
  };
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

function mapMessages(messages: SessionMessage[], historyLength?: number): Array<Record<string, unknown>> {
  const scoped = typeof historyLength === 'number'
    ? historyLength <= 0
      ? []
      : messages.slice(-historyLength)
    : messages;

  return scoped.map((message) => ({
    messageId: message.id,
    contextId: message.sessionId,
    taskId: message.sessionId,
    role: roleToA2ARole(message.role),
    parts: [{ text: message.content, mediaType: 'text/plain' }],
    ...(Object.keys(message.metadata).length > 0 ? { metadata: message.metadata } : {}),
  }));
}

function buildTask(session: SessionRecord, messages: SessionMessage[], historyLength?: number): Record<string, unknown> {
  const history = mapMessages(messages, historyLength);
  const latestAgentMessage = [...history].reverse().find((message) => message.role === 'ROLE_AGENT');
  return {
    id: session.id,
    contextId: session.id,
    status: {
      state: mapTaskState(session.status),
      ...(latestAgentMessage ? { message: latestAgentMessage } : {}),
      timestamp: session.updatedAt,
    },
    ...(history.length ? { history } : {}),
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
  if (typeof params.id === 'string' && params.id.trim()) {
    return params.id.trim();
  }
  if (typeof params.contextId === 'string' && params.contextId.trim()) {
    return params.contextId.trim();
  }
  throw new Error('`params.id` is required.');
}

function encodePageToken(offset: number): string {
  return Buffer.from(String(offset), 'utf8').toString('base64url');
}

function decodePageToken(token: unknown): number {
  if (typeof token !== 'string' || !token.trim()) return 0;
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeSse(response: ServerResponse, id: JsonRpcId, payload: unknown): void {
  response.write(`event: message\ndata: ${JSON.stringify({
    jsonrpc: '2.0',
    id,
    result: payload,
  })}\n\n`);
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
        respondJsonRpcError(response, null, 401, -32001, 'Unauthorized', { reason: 'UNAUTHORIZED' });
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

    const versionHeader = typeof request.headers['a2a-version'] === 'string'
      ? request.headers['a2a-version'].trim()
      : '';
    const negotiatedVersions = versionHeader
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (!negotiatedVersions.includes(A2A_PROTOCOL_VERSION)) {
      respondJsonRpcError(response, null, 400, -32009, 'Protocol version is not supported', {
        reason: 'VERSION_NOT_SUPPORTED',
        metadata: {
          requestedVersion: versionHeader || '0.3',
          supportedVersions: ['1.0'],
        },
      });
      return;
    }

    let rpc: JsonRpcRequest;
    try {
      const body = await readJsonBody(request);
      rpc = body as JsonRpcRequest;
    } catch (error) {
      respondJsonRpcError(response, null, 400, -32700, (error as Error).message, { reason: 'PARSE_ERROR' });
      return;
    }

    const rpcId = rpc.id ?? null;
    if (rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') {
      respondJsonRpcError(response, rpcId, 400, -32600, 'Invalid JSON-RPC request.', { reason: 'INVALID_REQUEST' });
      return;
    }

    const params = rpc.params ?? {};

    try {
      if (rpc.method === 'GetExtendedAgentCard') {
        respondJsonRpcSuccess(response, rpcId, buildExtendedAgentCard(agent, origin, requiresAuth));
        return;
      }

      if (rpc.method === 'SendMessage') {
        const parsed = parseMessageParts(params);
        const existing = store.getSession(parsed.contextId);
        if (existing && existing.agentId !== agent.id) {
          throw new Error('Task not found.');
        }

        const principalId = config.bearerToken ? 'generic-a2a:bearer' : 'generic-a2a:anonymous';
        const executeInput = {
          agentRef: agent.slug,
          sessionId: parsed.contextId,
          createIfMissing: true,
          message: parsed.messageText,
          mode: 'call' as const,
          title: `A2A task: ${parsed.messageText.slice(0, 50)}`,
          origin: 'generic_a2a',
          principalType: 'generic_a2a',
          principalId,
        };

        let session: SessionRecord | null;
        if (parsed.returnImmediately) {
          void runtime.execute(executeInput, () => undefined).catch(() => undefined);
          session = store.getSession(parsed.contextId);
        } else {
          const result = await runtime.execute(executeInput, () => undefined);
          session = store.getSession(result.session.id);
        }

        if (!session) {
          throw new Error('Task not found.');
        }

        respondJsonRpcSuccess(response, rpcId, {
          task: buildTask(session, store.getSessionMessages(session.id), parsed.historyLength),
        });
        return;
      }

      if (rpc.method === 'GetTask') {
        const taskId = taskIdFromParams(params);
        const session = store.getSession(taskId);
        if (!session || session.agentId !== agent.id) {
          throw new Error('Task not found.');
        }

        const historyLength = typeof params.historyLength === 'number'
          ? Math.max(0, Math.floor(params.historyLength))
          : undefined;
        respondJsonRpcSuccess(response, rpcId, buildTask(session, store.getSessionMessages(session.id), historyLength));
        return;
      }

      if (rpc.method === 'ListTasks') {
        const pageSize = Math.min(
          Math.max(typeof params.pageSize === 'number' ? Math.floor(params.pageSize) : 20, 1),
          100
        );
        const offset = decodePageToken(params.pageToken);
        const historyLength = typeof params.historyLength === 'number'
          ? Math.max(0, Math.floor(params.historyLength))
          : undefined;
        const sessions = store
          .listSessions({ agentId: agent.id, status: 'all' })
          .filter((session) => session.origin === 'generic_a2a');
        const page = sessions.slice(offset, offset + pageSize);
        const tasks = page.map((session) => buildTask(session, store.getSessionMessages(session.id), historyLength));

        respondJsonRpcSuccess(response, rpcId, {
          tasks,
          nextPageToken: offset + pageSize < sessions.length ? encodePageToken(offset + pageSize) : '',
          pageSize,
          totalSize: sessions.length,
        });
        return;
      }

      if (rpc.method === 'CancelTask') {
        const taskId = taskIdFromParams(params);
        const session = store.getSession(taskId);
        if (!session || session.agentId !== agent.id) {
          throw new Error('Task not found.');
        }

        const stopped = runtime.stopSession(taskId);
        respondJsonRpcSuccess(response, rpcId, buildTask(stopped, store.getSessionMessages(stopped.id)));
        return;
      }

      if (rpc.method === 'SendStreamingMessage') {
        const parsed = parseMessageParts(params);
        response.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'A2A-Version': A2A_PROTOCOL_VERSION,
        });

        const principalId = config.bearerToken ? 'generic-a2a:bearer' : 'generic-a2a:anonymous';
        try {
          await runtime.execute({
            agentRef: agent.slug,
            sessionId: parsed.contextId,
            createIfMissing: true,
            message: parsed.messageText,
            mode: 'call',
            title: `A2A task: ${parsed.messageText.slice(0, 50)}`,
            origin: 'generic_a2a',
            principalType: 'generic_a2a',
            principalId,
          }, (event) => {
            if (event.type === 'chunk') {
              writeSse(response, rpcId, {
                statusUpdate: {
                  taskId: parsed.contextId,
                  contextId: parsed.contextId,
                  status: {
                    state: 'TASK_STATE_WORKING',
                    timestamp: new Date().toISOString(),
                    message: {
                      messageId: randomUUID(),
                      contextId: parsed.contextId,
                      taskId: parsed.contextId,
                      role: 'ROLE_AGENT',
                      parts: [{ text: event.delta, mediaType: 'text/plain' }],
                    },
                  },
                },
              });
            }
          });
          const session = store.getSession(parsed.contextId);
          if (session) {
            writeSse(response, rpcId, {
              task: buildTask(session, store.getSessionMessages(session.id)),
            });
          }
        } catch (error) {
          writeSse(response, rpcId, {
            statusUpdate: {
              taskId: parsed.contextId,
              contextId: parsed.contextId,
              status: {
                state: 'TASK_STATE_FAILED',
                timestamp: new Date().toISOString(),
                message: {
                  messageId: randomUUID(),
                  contextId: parsed.contextId,
                  taskId: parsed.contextId,
                  role: 'ROLE_AGENT',
                  parts: [{ text: (error as Error).message || 'Streaming failed', mediaType: 'text/plain' }],
                },
              },
            },
          });
        }
        response.end();
        return;
      }

      if (rpc.method === 'SubscribeToTask') {
        const taskId = taskIdFromParams(params);
        const session = store.getSession(taskId);
        if (!session || session.agentId !== agent.id) {
          throw new Error('Task not found.');
        }
        if (['completed', 'failed', 'archived', 'paused'].includes(session.status)) {
          respondJsonRpcError(response, rpcId, 400, -32004, 'Unsupported operation', {
            reason: 'UNSUPPORTED_OPERATION',
            metadata: { taskId, state: mapTaskState(session.status) },
          });
          return;
        }

        response.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'A2A-Version': A2A_PROTOCOL_VERSION,
        });

        let lastStatus = session.status;
        writeSse(response, rpcId, {
          task: buildTask(session, store.getSessionMessages(session.id)),
        });

        const timer = setInterval(() => {
          const latest = store.getSession(taskId);
          if (!latest) {
            clearInterval(timer);
            response.end();
            return;
          }

          if (latest.status !== lastStatus) {
            lastStatus = latest.status;
            writeSse(response, rpcId, {
              statusUpdate: {
                taskId,
                contextId: latest.id,
                status: {
                  state: mapTaskState(latest.status),
                  timestamp: latest.updatedAt,
                },
              },
            });
          }

          if (['completed', 'failed', 'archived', 'paused'].includes(latest.status)) {
            writeSse(response, rpcId, {
              task: buildTask(latest, store.getSessionMessages(latest.id)),
            });
            clearInterval(timer);
            response.end();
          }
        }, 1000);

        request.on('close', () => {
          clearInterval(timer);
        });
        return;
      }

      respondJsonRpcError(response, rpcId, 404, -32601, `Method not found: ${rpc.method}`, {
        reason: 'METHOD_NOT_FOUND',
        metadata: { method: rpc.method },
      });
    } catch (error) {
      if (
        error
        && typeof error === 'object'
        && typeof (error as Partial<ProviderJsonRpcError>).statusCode === 'number'
        && typeof (error as Partial<ProviderJsonRpcError>).code === 'number'
        && typeof (error as Partial<ProviderJsonRpcError>).reason === 'string'
      ) {
        const typed = error as ProviderJsonRpcError;
        respondJsonRpcError(
          response,
          rpcId,
          typed.statusCode,
          typed.code,
          typed.message,
          { reason: typed.reason, metadata: typed.metadata },
        );
        return;
      }

      const message = (error as Error).message || 'Internal error.';
      const statusCode = message === 'Task not found.' ? 404 : 500;
      respondJsonRpcError(
        response,
        rpcId,
        statusCode,
        statusCode === 404 ? -32001 : -32603,
        message,
        { reason: statusCode === 404 ? 'TASK_NOT_FOUND' : 'INTERNAL_ERROR' }
      );
    }
  }
}

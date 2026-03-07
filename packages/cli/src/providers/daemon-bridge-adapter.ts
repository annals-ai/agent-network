import {
  AgentAdapter,
  type AdapterConfig,
  type SessionDonePayload,
  type SessionHandle,
  type ToolEvent,
} from '../adapters/base.js';
import type { DaemonRuntime } from '../daemon/runtime.js';
import type { DaemonStore } from '../daemon/store.js';
import type { DaemonAgent, ExecuteSessionResult, RuntimeStreamEvent } from '../daemon/types.js';

function inferRemoteMode(message: string): 'chat' | 'call' {
  return message.includes('[PLATFORM TASK]') ? 'call' : 'chat';
}

class DaemonBridgeSessionHandle implements SessionHandle {
  private readonly chunkCallbacks: Array<(delta: string) => void> = [];
  private readonly toolCallbacks: Array<(event: ToolEvent) => void> = [];
  private readonly doneCallbacks: Array<(payload?: SessionDonePayload) => void> = [];
  private readonly errorCallbacks: Array<(error: Error) => void> = [];
  private currentAbortController: AbortController | null = null;

  constructor(
    private readonly agent: DaemonAgent,
    private readonly sessionId: string,
    private readonly store: DaemonStore,
    private readonly runtime: DaemonRuntime,
  ) {}

  send(
    message: string,
    attachments?: { name: string; url: string; type: string }[],
    clientId?: string,
    withFiles?: boolean,
  ): void {
    const abortController = new AbortController();
    this.currentAbortController = abortController;

    void this.runtime.execute({
      agentRef: this.agent.id,
      sessionId: this.sessionId,
      createIfMissing: true,
      message,
      mode: inferRemoteMode(message),
      origin: 'provider:agents-hot',
      principalType: 'public_remote',
      principalId: clientId ?? 'remote',
      attachments,
      clientId,
      withFiles,
      signal: abortController.signal,
    }, (event) => {
      this.handleRuntimeEvent(event, abortController);
    }).then((result: ExecuteSessionResult) => {
      if (this.currentAbortController === abortController) {
        this.currentAbortController = null;
      }
      if (abortController.signal.aborted) {
        return;
      }
      this.emitDone(result.completion);
    }).catch((error: unknown) => {
      if (this.currentAbortController === abortController) {
        this.currentAbortController = null;
      }
      if (abortController.signal.aborted) {
        return;
      }
      this.emitError(error instanceof Error ? error : new Error(String(error)));
    });
  }

  onChunk(cb: (delta: string) => void): void {
    this.chunkCallbacks.push(cb);
  }

  onToolEvent(cb: (event: ToolEvent) => void): void {
    this.toolCallbacks.push(cb);
  }

  onDone(cb: (payload?: SessionDonePayload) => void): void {
    this.doneCallbacks.push(cb);
  }

  onError(cb: (error: Error) => void): void {
    this.errorCallbacks.push(cb);
  }

  getResumeSessionId(): string | undefined {
    return this.store.getSession(this.sessionId)?.claudeResumeId ?? undefined;
  }

  kill(): void {
    this.currentAbortController?.abort();
    this.currentAbortController = null;
    try {
      this.runtime.stopSession(this.sessionId);
    } catch {
      // Ignore missing sessions during teardown.
    }
  }

  private handleRuntimeEvent(event: RuntimeStreamEvent, abortController: AbortController): void {
    if (abortController.signal.aborted) {
      return;
    }

    switch (event.type) {
      case 'chunk':
        for (const cb of this.chunkCallbacks) {
          cb(event.delta);
        }
        break;
      case 'tool':
        for (const cb of this.toolCallbacks) {
          cb(event.event);
        }
        break;
      default:
        break;
    }
  }

  private emitDone(payload?: SessionDonePayload): void {
    for (const cb of this.doneCallbacks) {
      cb(payload);
    }
  }

  private emitError(error: Error): void {
    for (const cb of this.errorCallbacks) {
      cb(error);
    }
  }
}

export class DaemonBridgeAdapter extends AgentAdapter {
  readonly type = 'daemon-bridge';
  readonly displayName = 'Daemon Bridge Adapter';
  private readonly handles = new Map<string, DaemonBridgeSessionHandle>();

  constructor(
    private readonly agent: DaemonAgent,
    private readonly store: DaemonStore,
    private readonly runtime: DaemonRuntime,
  ) {
    super();
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  createSession(id: string, _config: AdapterConfig): SessionHandle {
    const existing = this.handles.get(id);
    if (existing) {
      return existing;
    }

    const handle = new DaemonBridgeSessionHandle(this.agent, id, this.store, this.runtime);
    this.handles.set(id, handle);
    return handle;
  }

  destroySession(id: string): void {
    const handle = this.handles.get(id);
    handle?.kill();
    this.handles.delete(id);
  }
}

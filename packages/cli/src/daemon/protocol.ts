export interface DaemonRequest {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface DaemonEventEnvelope {
  id: string;
  type: 'event';
  event: unknown;
}

export interface DaemonResultEnvelope {
  id: string;
  type: 'result';
  result: unknown;
}

export interface DaemonErrorEnvelope {
  id: string;
  type: 'error';
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type DaemonEnvelope =
  | DaemonEventEnvelope
  | DaemonResultEnvelope
  | DaemonErrorEnvelope;

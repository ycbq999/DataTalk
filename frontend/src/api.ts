export interface User {
  id: number;
  username: string;
}

export interface Session {
  user: User | null;
}

export interface Security {
  id: number;
  symbol: string;
  exchange: string;
  name: string;
}

export interface Entry {
  id: number;
  security: Security;
}

export interface Watchlist {
  id: number;
  name: string;
  entries: Entry[];
}

export interface Run {
  id: number;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string;
}

export interface Thesis {
  id: number;
  version: number;
  created_at: string;
  model: string;
  report: {
    summary: string;
    bull_case: string;
    bear_case: string;
    assumptions: string[];
    catalysts: string[];
    risks: string[];
    invalidation_conditions: string[];
    investment_horizon: string;
    uncertainty: string;
  };
  sources: Array<{ url: string; title: string; published_at: string | null; claims?: string[] }>;
}

export interface Research {
  enabled: boolean;
  runs: Run[];
  theses: Thesis[];
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function csrfToken() {
  return document.cookie
    .split('; ')
    .find((part) => part.startsWith('csrftoken='))
    ?.slice('csrftoken='.length);
}

function messageFromResponse(payload: unknown): string | undefined {
  if (typeof payload === 'string') return payload;
  if (Array.isArray(payload)) {
    return payload.map(messageFromResponse).filter(Boolean).join(' ') || undefined;
  }
  if (payload && typeof payload === 'object') {
    if ('detail' in payload) return messageFromResponse(payload.detail);
    return Object.values(payload).map(messageFromResponse).filter(Boolean).join(' ') || undefined;
  }
  return undefined;
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Could not connect to ThesisWatch. Try again.';
}

export async function request<T>(
  path: string,
  { method = 'GET', body, signal }: { method?: Method; body?: object; signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') {
    headers['X-CSRFToken'] = csrfToken() ?? '';
  }
  if (body) headers['Content-Type'] = 'application/json';

  const response = await fetch(`/api/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
    credentials: 'same-origin',
  });
  if (response.status === 204) return undefined as T;

  const payload: unknown = response.headers.get('Content-Type')?.includes('application/json')
    ? await response.json()
    : undefined;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      messageFromResponse(payload)
        ?? (response.status === 403
          ? 'Your session could not be verified. Refresh the page and try again.'
          : 'ThesisWatch could not complete the request. Try again.'),
    );
  }
  if (payload === undefined) throw new ApiError(response.status, 'ThesisWatch returned an unexpected response.');
  return payload as T;
}

export function isActiveRun(run: Run | undefined) {
  return run?.status === 'queued' || run?.status === 'running';
}

export function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeZone: /^\d{4}-\d{2}-\d{2}$/.test(value) ? 'UTC' : undefined,
    }).format(date);
}

import type {
  AccountView,
  Article,
  BookSummary,
  CapitalAction,
  CapitalRequest,
  PerformanceRecord,
  RecoveryStatus,
  SessionUser,
  SettlementPreviewResponse,
} from './types';

/** Empty by default so calls go to /api on this origin and the cookie stays first-party. */
const BASE = import.meta.env.VITE_API_BASE ?? '';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      credentials: 'include',
      ...init,
      headers: {
        ...(init.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let body: unknown = null;
  let notJson = false;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
    notJson = true;
  }

  /*
   * A reply that is not JSON did not come from this API. In practice that means
   * the requests are going somewhere else — most often a static host answering
   * with its own page because VITE_API_BASE was empty at build time, so
   * /api/... resolved against the site's own origin.
   *
   * Treated as its own failure rather than folded into the generic message,
   * because a 404 of HTML and a real 404 from the API need completely
   * different fixes, and the old code turned this into `null` and let the
   * caller crash on it.
   */
  if (notJson) {
    const sentTo = `${BASE || window.location.origin}/api${path}`;
    console.error(
      `[api] ${sentTo} answered ${res.status} with ${res.headers.get('content-type') ?? 'no content type'}, not JSON.\n` +
        '      The app is probably pointed at the wrong server. Set VITE_API_BASE to the API\'s\n' +
        '      address in frontend/.env and rebuild, or leave it empty only when the API is\n' +
        '      served from this same domain.',
    );
    throw new ApiError(
      res.status,
      'Could not reach the server. If you own this site, check that the app is pointed at the API.',
    );
  }

  if (!res.ok) {
    const payload = body as { error?: string; fields?: Array<{ path: string; message: string }> };
    throw new ApiError(
      res.status,
      payload?.error ?? 'Something went wrong. Please try again.',
      payload?.fields,
    );
  }

  return body as T;
}

export const api = {
  auth: {
    /** `scope: 'staff'` marks the /admin door; the server accepts managers only there. */
    login: (email: string, password: string, scope?: 'investor' | 'staff') =>
      request<{ user: SessionUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, scope }),
      }),
    logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
    /** Spend a recovery code to set a new password. Issues no session. */
    recover: (email: string, code: string, newPassword: string) =>
      request<{ ok: true; remaining: number }>('/auth/recover', {
        method: 'POST',
        body: JSON.stringify({ email, code, newPassword }),
      }),
    recoveryStatus: () => request<RecoveryStatus>('/auth/recovery-codes'),
    /** Replaces any existing set. The only time the codes are readable. */
    regenerateRecoveryCodes: (password: string) =>
      request<{ codes: string[]; issuedAt: string }>('/auth/recovery-codes', {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    me: () => request<{ user: SessionUser }>('/auth/me'),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ ok: true }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
  },

  accounts: {
    mine: () => request<{ account: AccountView }>('/accounts/me'),
    book: () => request<BookSummary>('/accounts'),
    get: (id: string) => request<{ account: AccountView }>(`/accounts/${id}`),
    create: (input: {
      name: string;
      email: string;
      tier: string;
      depositedCapital: number;
      joinedAt: string;
      notes?: string;
    }) =>
      request<{ account: AccountView; temporaryPassword: string }>('/accounts', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    update: (id: string, input: Record<string, unknown>) =>
      request<{ account: AccountView }>(`/accounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    resetPassword: (id: string) =>
      request<{ temporaryPassword: string; email: string }>(`/accounts/${id}/reset-password`, {
        method: 'POST',
      }),
    records: (id: string) => request<{ records: PerformanceRecord[] }>(`/accounts/${id}/records`),
    addRecord: (
      id: string,
      input: {
        year: number;
        month: number;
        openingBalance: number;
        nfpResult: number;
        realisedPnl: number;
        closingEquity: number;
        brokerVerified?: boolean;
        notes?: string;
      },
    ) =>
      request<{ account: AccountView }>(`/accounts/${id}/records`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    deleteRecord: (id: string, recordId: string) =>
      request<{ account: AccountView }>(`/accounts/${id}/records/${recordId}`, {
        method: 'DELETE',
      }),

    /** Statement PDFs are plain links so the browser handles the download. */
    positionStatementUrl: (id: string) => `${BASE}/api/accounts/${id}/statements/position.pdf`,
    monthlyReportUrl: (id: string, recordId: string) =>
      `${BASE}/api/accounts/${id}/statements/${recordId}.pdf`,
  },

  articles: {
    list: (category?: string) =>
      request<{ articles: Article[] }>(
        `/articles${category && category !== 'All' ? `?category=${encodeURIComponent(category)}` : ''}`,
      ),
    get: (slug: string) => request<{ article: Article }>(`/articles/${slug}`),
    all: () => request<{ articles: Article[] }>('/articles/admin/all'),
    create: (input: Record<string, unknown>) =>
      request<{ article: Article }>('/articles', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: string, input: Record<string, unknown>) =>
      request<{ article: Article }>(`/articles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    remove: (id: string) => request<{ ok: true }>(`/articles/${id}`, { method: 'DELETE' }),
    upload: (id: string, file: File) => {
      const form = new FormData();
      form.append('file', file);
      return request<{ article: Article }>(`/articles/${id}/assets`, {
        method: 'POST',
        body: form,
      });
    },
    removeAsset: (id: string, assetId: string) =>
      request<{ article: Article }>(`/articles/${id}/assets/${assetId}`, { method: 'DELETE' }),
    downloadUrl: (slug: string, assetId: string) =>
      `${BASE}/api/articles/${slug}/download/${assetId}`,
  },

  capitalRequests: {
    create: (input: { action: CapitalAction; contactName: string; amount: number }) =>
      request<{ request: CapitalRequest }>('/capital-requests', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    mine: () => request<{ requests: CapitalRequest[] }>('/capital-requests/me'),
    queue: (status?: string) =>
      request<{ requests: CapitalRequest[] }>(
        `/capital-requests${status && status !== 'all' ? `?status=${status}` : ''}`,
      ),
    preview: (id: string) =>
      request<SettlementPreviewResponse>(`/capital-requests/${id}/preview`),
    update: (id: string, input: { status: string; managerNote?: string }) =>
      request<{ request: CapitalRequest; account: AccountView | null }>(`/capital-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
  },

  subscribers: {
    join: (email: string, source = 'reports') =>
      request<{ ok: true }>('/subscribers', {
        method: 'POST',
        body: JSON.stringify({ email, source }),
      }),
    list: () =>
      request<{ subscribers: Array<{ _id: string; email: string; createdAt: string }>; count: number }>(
        '/subscribers',
      ),
  },
};

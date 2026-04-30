import type {
  AuthResponse,
  FriendEntry,
  FriendRequestEntry,
  GameSettings,
  LeaderboardEntry,
  MatchHistoryEntry,
  NextTournamentMatch,
  PublicHighlight,
  TournamentDetails,
  TournamentSummary,
  UserProfile,
  UserSearchResponse,
  UserStats,
} from '../types/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: Record<string, unknown> | FormData;
  token?: string;
};

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  let isFormData = false;
  let requestBody: BodyInit | undefined;

  if (options.body instanceof FormData) {
    isFormData = true;
    requestBody = options.body;
  } else if (options.body) {
    requestBody = JSON.stringify(options.body);
  }

  if (!isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: requestBody,
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? String((payload as { message: string }).message)
        : `HTTP ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export const authApi = {
  register: (input: {
    email: string;
    username: string;
    password: string;
    preferredLanguage: 'fr' | 'en' | 'es';
  }) => requestJson<AuthResponse>('/auth/register', { method: 'POST', body: input }),

  login: (input: { email: string; password: string }) =>
    requestJson<AuthResponse>('/auth/login', { method: 'POST', body: input }),

  me: (token: string) => requestJson<UserProfile & { gameSettings: GameSettings }>('/auth/me', { token }),
};

export const usersApi = {
  me: (token: string) =>
    requestJson<UserProfile & { gameSettings: GameSettings }>('/users/me', { token }),

  updateMe: (
    token: string,
    input: Partial<Pick<UserProfile, 'username' | 'displayName' | 'bio' | 'preferredLanguage'>>,
  ) => requestJson<UserProfile & { gameSettings: GameSettings }>('/users/me', { method: 'PUT', token, body: input }),

  uploadAvatar: (token: string, file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return requestJson<UserProfile & { gameSettings: GameSettings }>('/users/me/avatar', {
      method: 'POST',
      token,
      body: formData,
    });
  },

  profile: (userId: string) => requestJson<UserProfile>(`/users/${userId}/profile`),
  search: (params: {
    q?: string;
    sortBy?: 'username' | 'elo' | 'wins' | 'createdAt';
    order?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
    minElo?: number;
    maxElo?: number;
    onlineOnly?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.set('q', params.q);
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.order) searchParams.set('order', params.order);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params.minElo !== undefined) searchParams.set('minElo', String(params.minElo));
    if (params.maxElo !== undefined) searchParams.set('maxElo', String(params.maxElo));
    if (params.onlineOnly !== undefined) {
      searchParams.set('onlineOnly', String(params.onlineOnly));
    }

    return requestJson<UserSearchResponse>(
      `/users/search?${searchParams.toString()}`,
    );
  },
};

export const friendsApi = {
  list: (token: string) => requestJson<FriendEntry[]>('/friends', { token }),
  incoming: (token: string) =>
    requestJson<FriendRequestEntry[]>('/friends/requests/incoming', { token }),
  request: (token: string, targetUserId: string) =>
    requestJson<unknown>(`/friends/${targetUserId}/request`, { method: 'POST', token }),
  accept: (token: string, requestId: string) =>
    requestJson<unknown>(`/friends/requests/${requestId}/accept`, { method: 'POST', token }),
  remove: (token: string, friendUserId: string) =>
    requestJson<unknown>(`/friends/${friendUserId}`, { method: 'DELETE', token }),
};

export const statsApi = {
  me: (token: string) => requestJson<UserStats>('/stats/me', { token }),
  meHistory: (token: string, limit = 20) =>
    requestJson<MatchHistoryEntry[]>(`/stats/me/history?limit=${limit}`, { token }),
  leaderboard: (limit = 25) =>
    requestJson<LeaderboardEntry[]>(`/stats/leaderboard?limit=${limit}`),
};

export const gameApi = {
  defaultSettings: () => requestJson<GameSettings>('/game/settings/default'),
  mySettings: (token: string) => requestJson<GameSettings>('/game/settings/me', { token }),
  updateMySettings: (token: string, input: Partial<GameSettings>) =>
    requestJson<GameSettings>('/game/settings/me', {
      method: 'PUT',
      token,
      body: input,
    }),
};

export const tournamentsApi = {
  list: () => requestJson<TournamentSummary[]>('/tournaments'),
  details: (id: string) => requestJson<TournamentDetails>(`/tournaments/${id}`),
  create: (
    token: string,
    input: { name: string; maxPlayers: 4 | 8 | 16; settings?: Partial<GameSettings> },
  ) => requestJson<TournamentDetails>('/tournaments', { method: 'POST', token, body: input }),
  register: (token: string, id: string) =>
    requestJson<unknown>(`/tournaments/${id}/register`, { method: 'POST', token }),
  start: (token: string, id: string) =>
    requestJson<TournamentDetails>(`/tournaments/${id}/start`, { method: 'POST', token }),
  nextMatch: (token: string, id: string) =>
    requestJson<NextTournamentMatch>(`/tournaments/${id}/next-match`, { token }),
};

export const publicApi = {
  highlights: (apiKey: string) =>
    requestJson<PublicHighlight[]>('/public/highlights', {
      headers: {
        'x-api-key': apiKey,
      },
    }),
};

export type LanguageCode = 'fr' | 'en' | 'es';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string;
  preferredLanguage: LanguageCode;
  isOnline: boolean;
  wins: number;
  losses: number;
  elo: number;
  xp: number;
  level: number;
}

export interface AuthResponse {
  accessToken: string;
  user: UserProfile;
}

export interface FriendEntry {
  friendshipId: string;
  friend: Pick<
    UserProfile,
    'id' | 'username' | 'displayName' | 'avatarUrl' | 'isOnline' | 'elo' | 'level'
  > & { lastSeenAt?: string | null };
}

export interface FriendRequestEntry {
  id: string;
  requester: Pick<
    UserProfile,
    'id' | 'username' | 'displayName' | 'avatarUrl' | 'isOnline' | 'elo' | 'level'
  >;
  createdAt: string;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  avatarUrl: string;
  wins: number;
  losses: number;
  elo: number;
  level: number;
}

export interface MatchHistoryEntry {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  opponent: {
    id: string;
    username: string;
    avatarUrl: string;
  };
  userScore: number;
  opponentScore: number;
  didWin: boolean;
  winner: {
    id: string;
    username: string;
  } | null;
  settings: Record<string, unknown>;
  tournamentMatchId?: string;
}

export interface AchievementEntry {
  key: string;
  unlockedAt: string;
}

export interface UserStats {
  id: string;
  username: string;
  avatarUrl: string;
  wins: number;
  losses: number;
  elo: number;
  xp: number;
  level: number;
  matchesPlayed: number;
  winRate: number;
  achievements: AchievementEntry[];
}

export interface GameSettings {
  theme: 'classic' | 'neon' | 'sunset';
  map: 'arena' | 'space' | 'grid';
  paddleSize: number;
  ballSpeed: number;
  powerUpsEnabled: boolean;
  winningScore: number;
}

export interface RuntimeMatchState {
  id: string;
  roomId: string;
  status: 'live' | 'finished';
  winnerId?: string;
  tournamentMatchId?: string;
  settings: GameSettings;
  dimensions: {
    width: number;
    height: number;
    paddleWidth: number;
    ballRadius: number;
  };
  players: {
    left: {
      userId: string;
      username: string;
      connected: boolean;
      paddleY: number;
    };
    right: {
      userId: string;
      username: string;
      connected: boolean;
      paddleY: number;
    };
  };
  score: {
    left: number;
    right: number;
  };
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  };
  powerUp?: {
    x: number;
    y: number;
  };
  disconnectGraceMs: number;
}

export interface TournamentSummary {
  id: string;
  name: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'FINISHED';
  maxPlayers: number;
  createdAt: string;
  createdBy: {
    id: string;
    username: string;
  };
  champion: {
    id: string;
    username: string;
  } | null;
  _count: {
    participants: number;
    matches: number;
  };
}

export interface TournamentDetails {
  id: string;
  name: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'FINISHED';
  maxPlayers: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  participants: Array<{
    id: string;
    seed: number;
    userId: string;
    user: {
      id: string;
      username: string;
      avatarUrl: string;
      elo: number;
    };
  }>;
  matches: Array<{
    id: string;
    round: number;
    position: number;
    status: 'PENDING' | 'LIVE' | 'FINISHED';
    playerOne: { id: string; username: string } | null;
    playerTwo: { id: string; username: string } | null;
    winner: { id: string; username: string } | null;
    linkedMatchId: string | null;
  }>;
}

export interface PublicHighlight {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    username: string;
  } | null;
}

export interface NextTournamentMatch {
  available: boolean;
  match?: {
    id: string;
    round: number;
    position: number;
    playerOne: { id: string; username: string } | null;
    playerTwo: { id: string; username: string } | null;
  };
}

export interface UserSearchResponse {
  items: UserProfile[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  filters: {
    q: string | null;
    sortBy: 'username' | 'elo' | 'wins' | 'createdAt';
    order: 'asc' | 'desc';
    minElo: number | null;
    maxElo: number | null;
    onlineOnly: boolean;
  };
}

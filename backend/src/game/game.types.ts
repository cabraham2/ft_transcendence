export type PlayerInput = -1 | 0 | 1;

export interface MatchSettings {
  theme: string;
  map: string;
  paddleSize: number;
  ballSpeed: number;
  powerUpsEnabled: boolean;
  winningScore: number;
}

export interface MatchSettingsInput {
  theme?: string;
  map?: string;
  paddleSize?: number;
  ballSpeed?: number;
  powerUpsEnabled?: boolean;
  winningScore?: number;
}

export interface RuntimePlayer {
  userId: string;
  username: string;
  socketId: string | null;
  paddleY: number;
  input: PlayerInput;
  connected: boolean;
  disconnectedAt?: number;
}

export interface RuntimePowerUp {
  x: number;
  y: number;
}

export interface RuntimeMatch {
  id: string;
  roomId: string;
  createdAt: number;
  updatedAt: number;
  settings: MatchSettings;
  playerOne: RuntimePlayer;
  playerTwo: RuntimePlayer;
  scoreOne: number;
  scoreTwo: number;
  status: 'live' | 'finished';
  winnerId?: string;
  tournamentMatchId?: string;
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  };
  powerUp?: RuntimePowerUp;
  lastPowerUpAt: number;
}

export interface QueueEntry {
  userId: string;
  socketId: string;
  settings: MatchSettingsInput;
  queuedAt: number;
}

const THEMES = new Set(['classic', 'neon', 'sunset']);
const MAPS = new Set(['arena', 'space', 'grid']);

export const DEFAULT_MATCH_SETTINGS: MatchSettings = {
  theme: 'classic',
  map: 'arena',
  paddleSize: 120,
  ballSpeed: 6,
  powerUpsEnabled: false,
  winningScore: 11,
};

export function normalizeMatchSettings(
  input?: MatchSettingsInput | null,
): MatchSettings {
  const safeInput = input ?? {};

  const theme =
    typeof safeInput.theme === 'string' && THEMES.has(safeInput.theme)
      ? safeInput.theme
      : DEFAULT_MATCH_SETTINGS.theme;

  const map =
    typeof safeInput.map === 'string' && MAPS.has(safeInput.map)
      ? safeInput.map
      : DEFAULT_MATCH_SETTINGS.map;

  const paddleSize = clampNumber(safeInput.paddleSize, 80, 180, 120);
  const ballSpeed = clampNumber(safeInput.ballSpeed, 4, 10, 6);
  const winningScore = clampInteger(safeInput.winningScore, 5, 21, 11);

  return {
    theme,
    map,
    paddleSize,
    ballSpeed,
    powerUpsEnabled: Boolean(safeInput.powerUpsEnabled),
    winningScore,
  };
}

function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, value));
}

function clampInteger(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}

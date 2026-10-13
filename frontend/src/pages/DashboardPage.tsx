import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MatchCanvas } from '../components/game/MatchCanvas';
import { Panel } from '../components/ui/Panel';
import { useAuth } from '../hooks/useAuth';
import { gameApi, statsApi } from '../lib/api';
import { connectSocket, getSocket } from '../lib/socket';
import type {
  GameSettings,
  LeaderboardEntry,
  MatchHistoryEntry,
  RuntimeMatchState,
  UserStats,
} from '../types/api';

export function DashboardPage() {
  const { t } = useTranslation();
  const { token } = useAuth();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [activeMatch, setActiveMatch] = useState<RuntimeMatchState | null>(null);
  const [isInQueue, setIsInQueue] = useState(false);
  const [socketOnline, setSocketOnline] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const loadSnapshot = async () => {
    if (!token) {
      return;
    }

    const [leaderboardData, historyData, statsData, mySettings] = await Promise.all([
      statsApi.leaderboard(10),
      statsApi.meHistory(token, 8),
      statsApi.me(token),
      gameApi.mySettings(token),
    ]);

    setLeaderboard(leaderboardData);
    setHistory(historyData);
    setStats(statsData);
    setSettings(mySettings);
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadSnapshot();
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = connectSocket(token);

    const onConnect = () => {
      setSocketOnline(true);
      socket.emit('game:active', (response: { active: boolean; match?: RuntimeMatchState }) => {
        if (response.active && response.match) {
          setActiveMatch(response.match);
        }
      });
    };

    const onDisconnect = () => setSocketOnline(false);
    const onStarted = (payload: { match: RuntimeMatchState }) => {
      setActiveMatch(payload.match);
      setIsInQueue(false);
      setStatusMessage(t('dashboard.matchStarted'));
    };

    const onState = (payload: { match: RuntimeMatchState }) => {
      setActiveMatch(payload.match);
    };

    const onFinished = (payload: { match: RuntimeMatchState }) => {
      setActiveMatch(payload.match);
      setStatusMessage(t('dashboard.matchFinished'));
      void loadSnapshot();
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('game:started', onStarted);
    socket.on('game:state', onState);
    socket.on('game:finished', onFinished);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('game:started', onStarted);
      socket.off('game:state', onState);
      socket.off('game:finished', onFinished);
    };
  }, [token]);

  useEffect(() => {
    if (!activeMatch || activeMatch.status !== 'live') {
      return;
    }

    const socket = getSocket();
    if (!socket) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') {
        socket.emit('game:input', { matchId: activeMatch.id, direction: -1 });
      }

      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
        socket.emit('game:input', { matchId: activeMatch.id, direction: 1 });
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown' ||
        event.key.toLowerCase() === 'w' ||
        event.key.toLowerCase() === 's'
      ) {
        socket.emit('game:input', { matchId: activeMatch.id, direction: 0 });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [activeMatch]);

  const queueActions = useMemo(() => {
    return {
      join: () => {
        const socket = getSocket();
        if (!socket || !settings) {
          return;
        }

        socket.emit('matchmaking:join', { settings }, () => {
          setIsInQueue(true);
          setStatusMessage(t('dashboard.queueJoined'));
        });
      },
      leave: () => {
        const socket = getSocket();
        if (!socket) {
          return;
        }

        socket.emit('matchmaking:leave', () => {
          setIsInQueue(false);
          setStatusMessage(t('dashboard.queueLeft'));
        });
      },
    };
  }, [settings, t]);

  const saveSettings = async () => {
    if (!token || !settings) {
      return;
    }

    try {
      const updated = await gameApi.updateMySettings(token, settings);
      setSettings(updated);
      setStatusMessage(t('common.success'));
    } catch {
      setStatusMessage(t('common.error'));
    }
  };

  return (
    <div className="dashboard-grid">
      <Panel className="hero-panel">
        <h1>{t('dashboard.title')}</h1>
        <p>{t('dashboard.subtitle')}</p>

        <div className="hero-badges">
          <span className={`badge ${socketOnline ? 'badge-online' : 'badge-offline'}`}>
            WS: {socketOnline ? t('dashboard.wsOnline') : t('dashboard.wsOffline')}
          </span>
          <span className="badge">ELO: {stats?.elo ?? '-'}</span>
          <span className="badge">W/L: {stats ? `${stats.wins}/${stats.losses}` : '-'}</span>
        </div>

        <div className="inline-actions">
          <button
            type="button"
            className="primary-button"
            onClick={queueActions.join}
            disabled={!settings || activeMatch?.status === 'live' || isInQueue}
          >
            {t('dashboard.queueJoin')}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={queueActions.leave}
            disabled={!isInQueue}
          >
            {t('dashboard.queueLeave')}
          </button>
        </div>

        {statusMessage ? <p className="status-message">{statusMessage}</p> : null}
      </Panel>

      <Panel title={t('dashboard.activeMatch')} className="match-panel">
        {activeMatch ? (
          <MatchCanvas match={activeMatch} />
        ) : (
          <p className="placeholder">{t('dashboard.noMatch')}</p>
        )}
      </Panel>

      <Panel title={t('dashboard.customization')}>
        {settings ? (
          <div className="form-grid">
            <label>
              <span>{t('dashboard.theme')}</span>
              <select
                value={settings.theme}
                onChange={(event) =>
                  setSettings((current) =>
                    current ? { ...current, theme: event.target.value as GameSettings['theme'] } : current,
                  )
                }
              >
                <option value="classic">{t('dashboard.themeClassic')}</option>
                <option value="neon">{t('dashboard.themeNeon')}</option>
                <option value="sunset">{t('dashboard.themeSunset')}</option>
              </select>
            </label>

            <label>
              <span>{t('dashboard.map')}</span>
              <select
                value={settings.map}
                onChange={(event) =>
                  setSettings((current) =>
                    current ? { ...current, map: event.target.value as GameSettings['map'] } : current,
                  )
                }
              >
                <option value="arena">{t('dashboard.mapArena')}</option>
                <option value="space">{t('dashboard.mapSpace')}</option>
                <option value="grid">{t('dashboard.mapGrid')}</option>
              </select>
            </label>

            <label>
              <span>{t('dashboard.paddleSize')}</span>
              <input
                type="number"
                min={80}
                max={180}
                value={settings.paddleSize}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? { ...current, paddleSize: Number(event.target.value) }
                      : current,
                  )
                }
              />
            </label>

            <label>
              <span>{t('dashboard.ballSpeed')}</span>
              <input
                type="number"
                min={4}
                max={10}
                step={0.5}
                value={settings.ballSpeed}
                onChange={(event) =>
                  setSettings((current) =>
                    current ? { ...current, ballSpeed: Number(event.target.value) } : current,
                  )
                }
              />
            </label>

            <label>
              <span>{t('dashboard.winningScore')}</span>
              <input
                type="number"
                min={5}
                max={21}
                value={settings.winningScore}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? { ...current, winningScore: Number(event.target.value) }
                      : current,
                  )
                }
              />
            </label>

            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={settings.powerUpsEnabled}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? { ...current, powerUpsEnabled: event.target.checked }
                      : current,
                  )
                }
              />
              <span>{t('dashboard.powerups')}</span>
            </label>

            <button type="button" className="primary-button" onClick={saveSettings}>
              {t('dashboard.saveSettings')}
            </button>
          </div>
        ) : (
          <p>{t('common.loading')}</p>
        )}
      </Panel>

      <Panel title={t('dashboard.leaderboard')}>
        <ol className="simple-list">
          {leaderboard.map((entry) => (
            <li key={entry.id}>
              <span>{entry.username}</span>
              <strong>{entry.elo}</strong>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title={t('dashboard.history')}>
        <ul className="simple-list">
          {history.map((entry) => (
            <li key={entry.id}>
              <span>
                {entry.didWin ? 'W' : 'L'} vs {entry.opponent.username}
              </span>
              <strong>
                {entry.userScore}-{entry.opponentScore}
              </strong>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

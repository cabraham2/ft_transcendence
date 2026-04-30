import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Panel } from '../components/ui/Panel';
import { useAuth } from '../hooks/useAuth';
import { tournamentsApi } from '../lib/api';
import { connectSocket } from '../lib/socket';
import type { TournamentDetails, TournamentSummary } from '../types/api';

export function TournamentsPage() {
  const { t } = useTranslation();
  const { token } = useAuth();

  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [details, setDetails] = useState<TournamentDetails | null>(null);
  const [newName, setNewName] = useState('42 League Cup');
  const [maxPlayers, setMaxPlayers] = useState<4 | 8 | 16>(8);
  const [nextMatchId, setNextMatchId] = useState('');

  const loadTournaments = async () => {
    const list = await tournamentsApi.list();
    setTournaments(list);

    if (!selectedTournamentId && list[0]) {
      setSelectedTournamentId(list[0].id);
    }
  };

  const loadDetails = async (tournamentId: string) => {
    const response = await tournamentsApi.details(tournamentId);
    setDetails(response);
  };

  useEffect(() => {
    void loadTournaments();
  }, []);

  useEffect(() => {
    if (!selectedTournamentId) {
      return;
    }
    void loadDetails(selectedTournamentId);
  }, [selectedTournamentId]);

  const groupedMatches = useMemo(() => {
    if (!details) {
      return {} as Record<number, TournamentDetails['matches']>;
    }

    return details.matches.reduce<Record<number, TournamentDetails['matches']>>(
      (groups, match) => {
        groups[match.round] = [...(groups[match.round] ?? []), match];
        return groups;
      },
      {},
    );
  }, [details]);

  const queueForMatch = () => {
    if (!token || !nextMatchId) {
      return;
    }

    const socket = connectSocket(token);
    socket.emit('tournament:queue', { tournamentMatchId: nextMatchId });
  };

  return (
    <div className="two-column-page">
      <Panel title={t('tournaments.title')}>
        <ul className="simple-list">
          {tournaments.map((tournament) => (
            <li key={tournament.id}>
              <button
                type="button"
                className={`list-button ${
                  tournament.id === selectedTournamentId ? 'active' : ''
                }`}
                onClick={() => setSelectedTournamentId(tournament.id)}
              >
                {tournament.name} ({tournament._count.participants}/{tournament.maxPlayers})
              </button>
            </li>
          ))}
        </ul>

        <div className="form-grid">
          <h4>{t('tournaments.create')}</h4>
          <label>
            <span>{t('tournaments.name')}</span>
            <input value={newName} onChange={(event) => setNewName(event.target.value)} />
          </label>
          <label>
            <span>{t('tournaments.maxPlayers')}</span>
            <select
              value={maxPlayers}
              onChange={(event) => setMaxPlayers(Number(event.target.value) as 4 | 8 | 16)}
            >
              <option value={4}>4</option>
              <option value={8}>8</option>
              <option value={16}>16</option>
            </select>
          </label>

          <button
            type="button"
            className="primary-button"
            onClick={async () => {
              if (!token) {
                return;
              }

              await tournamentsApi.create(token, {
                name: newName,
                maxPlayers,
              });

              await loadTournaments();
            }}
          >
            {t('tournaments.create')}
          </button>
        </div>
      </Panel>

      <Panel title={details ? details.name : t('common.loading')}>
        {details ? (
          <>
            <div className="inline-actions">
              <button
                type="button"
                className="primary-button"
                onClick={async () => {
                  if (!token) {
                    return;
                  }
                  await tournamentsApi.register(token, details.id);
                  await loadDetails(details.id);
                  await loadTournaments();
                }}
              >
                {t('tournaments.register')}
              </button>

              <button
                type="button"
                className="ghost-button"
                onClick={async () => {
                  if (!token) {
                    return;
                  }
                  await tournamentsApi.start(token, details.id);
                  await loadDetails(details.id);
                  await loadTournaments();
                }}
              >
                {t('tournaments.start')}
              </button>

              <button
                type="button"
                className="ghost-button"
                onClick={async () => {
                  if (!token) {
                    return;
                  }
                  const nextMatch = await tournamentsApi.nextMatch(token, details.id);
                  setNextMatchId(nextMatch.match?.id ?? '');
                }}
              >
                {t('tournaments.nextMatch')}
              </button>
            </div>

            <div className="inline-form">
              <input
                value={nextMatchId}
                onChange={(event) => setNextMatchId(event.target.value)}
                placeholder="Tournament match id"
              />
              <button type="button" className="primary-button" onClick={queueForMatch}>
                {t('tournaments.queueForMatch')}
              </button>
            </div>

            <div className="bracket-grid">
              {Object.entries(groupedMatches)
                .sort(([left], [right]) => Number(left) - Number(right))
                .map(([round, matches]) => (
                  <div key={round} className="round-column">
                    <h4>Round {round}</h4>
                    {matches.map((match) => (
                      <article key={match.id} className="match-card">
                        <p>{match.playerOne?.username ?? 'TBD'}</p>
                        <p>{match.playerTwo?.username ?? 'TBD'}</p>
                        <small>{match.status}</small>
                        {match.winner ? <strong>Winner: {match.winner.username}</strong> : null}
                      </article>
                    ))}
                  </div>
                ))}
            </div>
          </>
        ) : (
          <p>{t('common.loading')}</p>
        )}
      </Panel>
    </div>
  );
}

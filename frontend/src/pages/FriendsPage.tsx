import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Panel } from '../components/ui/Panel';
import { useAuth } from '../hooks/useAuth';
import { friendsApi, usersApi } from '../lib/api';
import { useGuardedAction } from '../lib/guard';
import type {
  FriendEntry,
  FriendRequestEntry,
  UserProfile,
  UserSearchResponse,
} from '../types/api';

export function FriendsPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { actionError, guarded } = useGuardedAction();

  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestEntry[]>([]);
  const [targetUserId, setTargetUserId] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchSortBy, setSearchSortBy] = useState<'username' | 'elo' | 'wins' | 'createdAt'>('elo');
  const [searchOrder, setSearchOrder] = useState<'asc' | 'desc'>('desc');
  const [searchPage, setSearchPage] = useState(1);
  const [searchResults, setSearchResults] = useState<UserSearchResponse | null>(null);

  const refresh = async () => {
    if (!token) {
      return;
    }

    const [friendsData, incomingData] = await Promise.all([
      friendsApi.list(token),
      friendsApi.incoming(token),
    ]);

    setFriends(friendsData);
    setIncoming(incomingData);
  };

  const runSearch = async (page = 1) => {
    const response = await usersApi.search({
      q: searchQuery,
      sortBy: searchSortBy,
      order: searchOrder,
      page,
      pageSize: 8,
    });

    setSearchPage(page);
    setSearchResults(response);
  };

  useEffect(() => {
    void refresh();
  }, [token]);

  useEffect(() => {
    void runSearch(1);
  }, []);

  const sendRequest = async () => {
    if (!token || !targetUserId.trim()) {
      return;
    }

    await guarded(async () => {
      await friendsApi.request(token, targetUserId.trim());
      setTargetUserId('');
      await refresh();
    });
  };

  return (
    <div className="two-column-page">
      <Panel title={t('friends.title')}>
        <ul className="simple-list">
          {friends.map((entry) => (
            <li key={entry.friendshipId}>
              <span>
                {entry.friend.username} {entry.friend.isOnline ? '●' : '○'}
              </span>
              <button
                type="button"
                className="ghost-button"
                onClick={() =>
                  void guarded(async () => {
                    if (!token) {
                      return;
                    }
                    await friendsApi.remove(token, entry.friend.id);
                    await refresh();
                  })
                }
              >
                {t('friends.remove')}
              </button>
            </li>
          ))}
        </ul>

        <div className="inline-form">
          <input
            value={targetUserId}
            onChange={(event) => setTargetUserId(event.target.value)}
            placeholder={t('friends.addById')}
          />
          <button type="button" className="primary-button" onClick={sendRequest}>
            {t('friends.send')}
          </button>
        </div>

        {actionError ? (
          <p className="form-error" role="alert">
            {actionError}
          </p>
        ) : null}

        <h4>{t('friends.search')}</h4>
        <div className="form-grid">
          <label>
            <span>{t('friends.query')}</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('friends.queryPlaceholder')}
            />
          </label>
          <label>
            <span>{t('friends.sortBy')}</span>
            <select
              value={searchSortBy}
              onChange={(event) =>
                setSearchSortBy(
                  event.target.value as 'username' | 'elo' | 'wins' | 'createdAt',
                )
              }
            >
              <option value="elo">ELO</option>
              <option value="wins">{t('friends.wins')}</option>
              <option value="username">{t('friends.usernameSort')}</option>
              <option value="createdAt">{t('friends.created')}</option>
            </select>
          </label>
          <label>
            <span>{t('friends.order')}</span>
            <select
              value={searchOrder}
              onChange={(event) =>
                setSearchOrder(event.target.value as 'asc' | 'desc')
              }
            >
              <option value="desc">{t('friends.desc')}</option>
              <option value="asc">{t('friends.asc')}</option>
            </select>
          </label>
          <button type="button" className="primary-button" onClick={() => void runSearch(1)}>
            {t('friends.searchButton')}
          </button>
        </div>

        {searchResults ? (
          <>
            <ul className="simple-list">
              {searchResults.items.map((candidate: UserProfile) => (
                <li key={candidate.id}>
                  <span>
                    {candidate.username} (ELO {candidate.elo})
                  </span>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      void guarded(async () => {
                        if (!token) {
                          return;
                        }
                        await friendsApi.request(token, candidate.id);
                        await refresh();
                      })
                    }
                  >
                    {t('friends.add')}
                  </button>
                </li>
              ))}
            </ul>
            <div className="inline-actions">
              <button
                type="button"
                className="ghost-button"
                disabled={searchPage <= 1}
                onClick={() => void runSearch(searchPage - 1)}
              >
                {t('friends.prev')}
              </button>
              <span>
                {t('friends.page', {
                  page: searchPage,
                  total: searchResults.pagination.totalPages,
                })}
              </span>
              <button
                type="button"
                className="ghost-button"
                disabled={searchPage >= searchResults.pagination.totalPages}
                onClick={() => void runSearch(searchPage + 1)}
              >
                {t('friends.next')}
              </button>
            </div>
          </>
        ) : null}
      </Panel>

      <Panel title={t('friends.requests')}>
        <ul className="simple-list">
          {incoming.map((request) => (
            <li key={request.id}>
              <span>{request.requester.username}</span>
              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  void guarded(async () => {
                    if (!token) {
                      return;
                    }
                    await friendsApi.accept(token, request.id);
                    await refresh();
                  })
                }
              >
                {t('friends.accept')}
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

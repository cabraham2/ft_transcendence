import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Panel } from '../components/ui/Panel';
import { useAuth } from '../hooks/useAuth';
import { usersApi } from '../lib/api';
import type { LanguageCode } from '../types/api';

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { token, user, setUser } = useAuth();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<LanguageCode>('fr');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }

    setUsername(user.username);
    setDisplayName(user.displayName ?? '');
    setBio(user.bio ?? '');
    setPreferredLanguage(user.preferredLanguage);
  }, [user]);

  const updateProfile = async () => {
    if (!token) {
      return;
    }

    const updated = await usersApi.updateMe(token, {
      username,
      displayName,
      bio,
      preferredLanguage,
    });

    setUser(updated);
    setStatus(t('common.success'));
    void i18n.changeLanguage(preferredLanguage);
  };

  const onAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!token || !event.target.files?.[0]) {
      return;
    }

    const updated = await usersApi.uploadAvatar(token, event.target.files[0]);
    setUser(updated);
    setStatus(t('common.success'));
  };

  return (
    <div className="two-column-page">
      <Panel title={t('profile.title')}>
        <div className="profile-card">
          <img src={user?.avatarUrl ?? '/assets/default-avatar.svg'} alt="avatar" />
          <div>
            <h2>{user?.displayName ?? user?.username}</h2>
            <p>ELO {user?.elo ?? 0}</p>
          </div>
        </div>

        <label className="file-input">
          <span>{t('profile.avatar')}</span>
          <input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={onAvatarChange} />
        </label>
      </Panel>

      <Panel title={t('profile.update')}>
        <div className="form-grid">
          <label>
            <span>{t('auth.username')}</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>

          <label>
            <span>{t('profile.displayName')}</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>

          <label>
            <span>{t('profile.bio')}</span>
            <textarea value={bio} onChange={(event) => setBio(event.target.value)} />
          </label>

          <label>
            <span>{t('auth.language')}</span>
            <select
              value={preferredLanguage}
              onChange={(event) => setPreferredLanguage(event.target.value as LanguageCode)}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </label>

          <button type="button" className="primary-button" onClick={updateProfile}>
            {t('profile.save')}
          </button>
          {status ? <p className="status-message">{status}</p> : null}
        </div>
      </Panel>
    </div>
  );
}

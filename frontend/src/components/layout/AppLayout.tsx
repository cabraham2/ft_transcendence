import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { LanguageSwitcher } from './LanguageSwitcher';

export function AppLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <Link to="/" className="brand-title">
            ft_transcendence
          </Link>
          <p className="brand-subtitle">Pong League Platform</p>
        </div>

        <nav className="top-nav">
          <NavLink to="/" end>
            {t('nav.home')}
          </NavLink>
          <NavLink to="/profile">{t('nav.profile')}</NavLink>
          <NavLink to="/friends">{t('nav.friends')}</NavLink>
          <NavLink to="/tournaments">{t('nav.tournaments')}</NavLink>
          <NavLink to="/privacy">{t('nav.privacy')}</NavLink>
          <NavLink to="/terms">{t('nav.terms')}</NavLink>
        </nav>

        <div className="topbar-actions">
          <LanguageSwitcher />
          <div className="user-chip">
            <img src={user?.avatarUrl ?? '/assets/default-avatar.svg'} alt="avatar" />
            <span>{user?.displayName ?? user?.username}</span>
          </div>
          <button type="button" className="ghost-button" onClick={logout}>
            {t('common.logout')}
          </button>
        </div>
      </header>

      <main className="page-content">
        <Outlet />
      </main>
    </div>
  );
}

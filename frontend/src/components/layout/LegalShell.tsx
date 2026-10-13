import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { AppLayout } from './AppLayout';
import { Footer } from './Footer';
import { LanguageSwitcher } from './LanguageSwitcher';

// Privacy and Terms must be reachable without an account (login/register footer),
// so they live outside the protected routes.
export function LegalShell() {
  const { user } = useAuth();
  const { t } = useTranslation();

  if (user) {
    return <AppLayout />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/login" className="brand-title">
          ft_transcendence
        </Link>
        <div className="topbar-actions">
          <LanguageSwitcher />
          <Link to="/login" className="ghost-button">
            {t('common.back')}
          </Link>
        </div>
      </header>
      <main className="page-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

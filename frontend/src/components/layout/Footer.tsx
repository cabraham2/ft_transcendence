import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="site-footer">
      <span>{t('common.footer')}</span>
      <nav aria-label="Legal">
        <Link to="/privacy">{t('nav.privacy')}</Link>
        <Link to="/terms">{t('nav.terms')}</Link>
      </nav>
    </footer>
  );
}

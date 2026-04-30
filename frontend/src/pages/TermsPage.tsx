import { useTranslation } from 'react-i18next';
import { Panel } from '../components/ui/Panel';

export function TermsPage() {
  const { t } = useTranslation();

  return (
    <Panel title={t('terms.title')}>
      <p>{t('terms.body')}</p>
    </Panel>
  );
}

import { useTranslation } from 'react-i18next';
import { Panel } from '../components/ui/Panel';

export function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <Panel title={t('privacy.title')}>
      <p>{t('privacy.body')}</p>
    </Panel>
  );
}

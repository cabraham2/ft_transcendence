import { useTranslation } from 'react-i18next';
import { Panel } from './Panel';

type LegalDocumentProps = {
  namespace: 'privacy' | 'terms';
  sections: number;
};

export function LegalDocument({ namespace, sections }: LegalDocumentProps) {
  const { t } = useTranslation();

  return (
    <Panel title={t(`${namespace}.title`)}>
      <p>
        <small>{t(`${namespace}.updated`)}</small>
      </p>
      {Array.from({ length: sections }, (_, index) => index + 1).map((id) => (
        <section key={id} className="legal-section">
          <h4>{t(`${namespace}.s${id}.h`)}</h4>
          <p>{t(`${namespace}.s${id}.p`)}</p>
        </section>
      ))}
    </Panel>
  );
}

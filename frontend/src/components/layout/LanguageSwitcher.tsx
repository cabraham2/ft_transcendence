import { useTranslation } from 'react-i18next';
import type { LanguageCode } from '../../types/api';

const languages: Array<{ value: LanguageCode; label: string }> = [
  { value: 'fr', label: 'FR' },
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div className="language-switcher" role="group" aria-label="Language switcher">
      {languages.map((language) => (
        <button
          key={language.value}
          type="button"
          className={i18n.language.startsWith(language.value) ? 'active' : ''}
          onClick={() => {
            void i18n.changeLanguage(language.value);
            localStorage.setItem('ft_transcendence_language', language.value);
          }}
        >
          {language.label}
        </button>
      ))}
    </div>
  );
}

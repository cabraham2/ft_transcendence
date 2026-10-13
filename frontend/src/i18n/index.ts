import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';
import es from './locales/es.json';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      es: { translation: es },
    },
    fallbackLng: 'en',
    supportedLngs: ['fr', 'en', 'es'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'ft_transcendence_language',
    },
  });

export default i18n;

// Keep <html lang> in sync with the selected language (accessibility / SEO).
const syncDocumentLanguage = (language: string) => {
  document.documentElement.lang = language.slice(0, 2);
};
i18n.on('languageChanged', syncDocumentLanguage);
syncDocumentLanguage(i18n.language ?? 'en');

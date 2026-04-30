import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi, ApiError } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { LanguageCode } from '../types/api';

export function RegisterPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<LanguageCode>('fr');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await authApi.register({
        email,
        username,
        password,
        preferredLanguage,
      });
      login(response);
      navigate('/', { replace: true });
    } catch (unknownError) {
      if (unknownError instanceof ApiError) {
        setError(unknownError.message);
      } else {
        setError(t('common.error'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>{t('auth.register')}</h1>

        <label>
          <span>{t('auth.email')}</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            required
          />
        </label>

        <label>
          <span>{t('auth.username')}</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            type="text"
            autoComplete="username"
            required
          />
        </label>

        <label>
          <span>{t('auth.password')}</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
            required
          />
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

        {error ? <p className="form-error">{error}</p> : null}

        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? t('common.loading') : t('auth.submit')}
        </button>

        <Link to="/login" className="auth-switch-link">
          {t('auth.switchToLogin')}
        </Link>
      </form>
    </div>
  );
}

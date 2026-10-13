import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi, ApiError } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Footer } from '../components/layout/Footer';
import type { LanguageCode } from '../types/api';

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 72 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

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

    const normalizedUsername = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setError(t('validation.username'));
      return;
    }
    if (!isStrongPassword(password)) {
      setError(t('validation.password'));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await authApi.register({
        email,
        username: normalizedUsername,
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
            minLength={3}
            maxLength={24}
            pattern="[a-zA-Z0-9_]{3,24}"
            title={t('auth.usernameHint')}
            aria-describedby="username-hint"
            required
          />
          <small id="username-hint">{t('auth.usernameHint')}</small>
        </label>

        <label>
          <span>{t('auth.password')}</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            aria-describedby="password-hint"
            required
          />
          <small id="password-hint">{t('auth.passwordHint')}</small>
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

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? t('common.loading') : t('auth.submit')}
        </button>

        <Link to="/login" className="auth-switch-link">
          {t('auth.switchToLogin')}
        </Link>
      </form>
      <Footer />
    </div>
  );
}

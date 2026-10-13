import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '../lib/api';
import { disconnectSocket } from '../lib/socket';
import type { AuthResponse, UserProfile } from '../types/api';

const TOKEN_STORAGE_KEY = 'ft_transcendence_token';

type AuthContextValue = {
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  login: (payload: AuthResponse) => void;
  logout: () => void;
  refreshMe: () => Promise<void>;
  setUser: (user: UserProfile) => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY),
  );
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    disconnectSocket();
  }, []);

  const refreshMe = useCallback(async () => {
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const me = await authApi.me(token);
      setUser(me);
    } catch {
      logout();
    }
  }, [logout, token]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!token) {
        if (mounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const me = await authApi.me(token);
        if (mounted) {
          setUser(me);
        }
      } catch {
        if (mounted) {
          logout();
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [logout, token]);

  const login = useCallback((payload: AuthResponse) => {
    setToken(payload.accessToken);
    setUser(payload.user);
    localStorage.setItem(TOKEN_STORAGE_KEY, payload.accessToken);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isLoading,
      login,
      logout,
      refreshMe,
      setUser,
    }),
    [token, user, isLoading, login, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

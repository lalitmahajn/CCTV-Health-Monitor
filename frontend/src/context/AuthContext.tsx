import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchAuthMe, loginAdmin, logoutAdmin } from '../lib/api';

export interface AuthUser {
  username: string;
  last_login?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshAuth = useCallback(async () => {
    try {
      const data = await fetchAuthMe();
      if (data.authenticated && data.username) {
        setIsAuthenticated(true);
        setUser({ username: data.username, last_login: data.last_login });
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch {
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();

    // Global listener for 401 Unauthorized responses
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setUser(null);
    };

    window.addEventListener('cctv:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('cctv:unauthorized', handleUnauthorized);
    };
  }, [refreshAuth]);

  const login = async (username: string, password: string) => {
    const res = await loginAdmin(username, password);
    if (res.authenticated && res.username) {
      setIsAuthenticated(true);
      setUser({ username: res.username });
    }
  };

  const logout = async () => {
    try {
      await logoutAdmin();
    } finally {
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        isLoading,
        login,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface UserSession {
  userId: string;
  name: string;
  token: string;
  isApplicant?: boolean;
}

interface UserAuthContextType {
  user: UserSession | null;
  loginAsApplicant: (name: string, panNumber: string | null, docId: string | null) => Promise<void>;
  loginManual: (token: string, name: string, userId: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const UserAuthContext = createContext<UserAuthContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function UserAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate session from localStorage on startup
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user_session');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {}
    setIsLoading(false);
  }, []);

  const loginAsApplicant = async (name: string, panNumber: string | null, docId: string | null) => {
    try {
      const res = await fetch(`${API_BASE}/api/user/applicant-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, panNumber, docId }),
      });
      const data = await res.json();
      if (data.success) {
        const session: UserSession = {
          userId: data.userId,
          name: data.name,
          token: data.token,
          isApplicant: true,
        };
        setUser(session);
        localStorage.setItem('user_session', JSON.stringify(session));
      }
    } catch (err) {
      console.error('Login error:', err);
      // Let the caller handle the error UI
    }
  };

  const loginManual = (token: string, name: string, userId: string) => {
    const session: UserSession = { userId, name, token, isApplicant: false };
    setUser(session);
    localStorage.setItem('user_session', JSON.stringify(session));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user_session');
  };

  return (
    <UserAuthContext.Provider value={{ user, loginAsApplicant, loginManual, logout, isLoading }}>
      {children}
    </UserAuthContext.Provider>
  );
}

export function useUserAuth() {
  const ctx = useContext(UserAuthContext);
  if (!ctx) throw new Error('useUserAuth must be used inside UserAuthProvider');
  return ctx;
}

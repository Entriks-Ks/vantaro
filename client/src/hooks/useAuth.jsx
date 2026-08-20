import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  forgotPasswordRequest,
  loginRequest,
  logoutRequest,
  registerRequest,
  resendVerificationRequest,
  restoreSession,
  verifyEmailRequest,
  verifyEmailTokenRequest,
} from '../lib/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    restoreSession()
      .then((session) => {
        if (active) setUser(session?.user ?? null);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      async login(email, password) {
        const session = await loginRequest(email, password);
        setUser(session.user);
        return session;
      },
      async register(payload) {
        return registerRequest(payload);
      },
      async verifyEmail(email, code) {
        return verifyEmailRequest(email, code);
      },
      async verifyEmailToken(tokenHash, type) {
        return verifyEmailTokenRequest(tokenHash, type);
      },
      async resendVerification(email) {
        return resendVerificationRequest(email);
      },
      async logout() {
        await logoutRequest();
        setUser(null);
      },
      async forgotPassword(email) {
        return forgotPasswordRequest(email);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

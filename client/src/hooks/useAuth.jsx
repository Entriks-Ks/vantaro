import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  changePasswordRequest,
  exchangeOAuthCallback,
  forgotPasswordRequest,
  loginRequest,
  logoutRequest,
  registerRequest,
  resendPasswordResetRequest,
  resendVerificationRequest,
  resetPasswordRequest,
  restoreSession,
  startAppleLogin,
  startGoogleLogin,
  updateProfileRequest,
  verifyEmailRequest,
  verifyEmailTokenRequest,
} from '../lib/auth';
import { ROLES, normalizeRole } from '../lib/roles';

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

  const login = useCallback(async (email, password) => {
    const session = await loginRequest(email, password);
    setUser(session.user);
    return session;
  }, []);

  const loginWithGoogle = useCallback(async (nextPath) => {
    await startGoogleLogin(nextPath);
  }, []);

  const loginWithApple = useCallback(async (nextPath) => {
    await startAppleLogin(nextPath);
  }, []);

  const completeOAuthLogin = useCallback(async () => {
    const session = await exchangeOAuthCallback();
    setUser(session.user);
    return session;
  }, []);

  const register = useCallback(async (payload) => registerRequest(payload), []);

  const verifyEmail = useCallback(async (email, code) => {
    const payload = await verifyEmailRequest(email, code);
    if (payload.user) setUser(payload.user);
    return payload;
  }, []);

  const verifyEmailToken = useCallback(async (email, token) => {
    const payload = await verifyEmailTokenRequest(email, token);
    if (payload.user) setUser(payload.user);
    return payload;
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const next = await updateProfileRequest(payload);
    if (next.user) setUser(next.user);
    return next;
  }, []);

  const changePassword = useCallback(async (payload) => (
    changePasswordRequest(payload)
  ), []);

  const resendVerification = useCallback(async (email) => (
    resendVerificationRequest(email)
  ), []);

  const logout = useCallback(async () => {
    await logoutRequest();
    window.location.replace('/');
  }, []);

  const forgotPassword = useCallback(async (email) => (
    forgotPasswordRequest(email)
  ), []);

  const resetPassword = useCallback(async (payload) => (
    resetPasswordRequest(payload)
  ), []);

  const resendPasswordReset = useCallback(async (email) => (
    resendPasswordResetRequest(email)
  ), []);

  const role = normalizeRole(user?.role);

  const value = useMemo(
    () => ({
      user: user ? { ...user, role } : null,
      role: user ? role : null,
      isBerater: Boolean(user) && role === ROLES.BERATER,
      isAdmin: Boolean(user) && role === ROLES.ADMIN,
      loading,
      login,
      loginWithGoogle,
      loginWithApple,
      completeOAuthLogin,
      register,
      verifyEmail,
      verifyEmailToken,
      updateProfile,
      changePassword,
      resendVerification,
      logout,
      forgotPassword,
      resetPassword,
      resendPasswordReset,
    }),
    [user, role, loading, login, loginWithGoogle, loginWithApple, completeOAuthLogin, register, verifyEmail, verifyEmailToken, updateProfile, changePassword, resendVerification, logout, forgotPassword, resetPassword, resendPasswordReset],
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

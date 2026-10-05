import { createContext, useContext } from "react";

export const AuthContext = createContext(null);

/** { user, loading, googleClientId, openAuth, closeAuth, login, signup, verifyEmail,
 *    resendVerification, loginWithGoogle, logout } */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

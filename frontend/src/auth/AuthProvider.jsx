import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import { AuthContext } from "./authContext";
import AuthModal from "./AuthModal";

export default function AuthProvider({ children }) {
  const [user,           setUser]           = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [googleClientId, setGoogleClientId] = useState(null);
  const [authEnabled,    setAuthEnabled]    = useState(false);  // false until the server says accounts exist
  const [modalMode,      setModalMode]      = useState(null);   // null | "login" | "signup"

  /* Restore the session and load public auth config on startup. */
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([apiRequest("/api/auth/me"), apiRequest("/api/auth/config")])
      .then(([me, config]) => {
        if (cancelled) return;
        if (me.status === "fulfilled")     setUser(me.value.user);
        if (config.status === "fulfilled") {
          setGoogleClientId(config.value.google_client_id);
          // Older servers don't send auth_enabled; they always had accounts.
          setAuthEnabled(config.value.auth_enabled !== false);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const post = (path, body) => apiRequest(path, { method: "POST", body });

  const openAuth  = useCallback((mode = "login") => setModalMode(mode), []);
  const closeAuth = useCallback(() => setModalMode(null), []);

  const value = useMemo(() => ({
    user,
    loading,
    authEnabled,
    googleClientId,
    openAuth,
    closeAuth,
    login: async (email, password) => {
      const data = await post("/api/auth/login", { email, password });
      setUser(data.user);
      return data.user;
    },
    signup: (name, email, password) => post("/api/auth/signup", { name, email, password }),
    resendVerification: (email) => post("/api/auth/resend-verification", { email }),
    verifyEmail: async (token) => {
      const data = await post("/api/auth/verify-email", { token });
      setUser(data.user);
      return data.user;
    },
    loginWithGoogle: async (credential) => {
      const data = await post("/api/auth/google", { credential });
      setUser(data.user);
      return data.user;
    },
    logout: async () => {
      await post("/api/auth/logout").catch(() => {});
      setUser(null);
    },
  }), [user, loading, authEnabled, googleClientId, openAuth, closeAuth]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {modalMode && <AuthModal initialMode={modalMode} onClose={closeAuth} />}
    </AuthContext.Provider>
  );
}

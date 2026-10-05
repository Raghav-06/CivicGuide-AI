import { useEffect, useRef, useState } from "react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { useAuth } from "./authContext";

const CloseIcon = ({ size = 18 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
);

const MailIcon = ({ size = 28 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════════════
   Sign in / create account dialog.
   Props:
     initialMode  — "login" | "signup"
     onClose()    — close the dialog
   ══════════════════════════════════════════════════════════════════════ */
export default function AuthModal({ initialMode = "login", onClose }) {
  const { login, signup, resendVerification, loginWithGoogle, googleClientId } = useAuth();

  const [mode,     setMode]     = useState(initialMode);
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState("");
  const [notice,   setNotice]   = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);  // login blocked until verified
  const [sentTo,          setSentTo]          = useState(null);  // sign-up done, check inbox

  const firstInputRef = useRef(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, mode]);

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setNotice("");
    setUnverifiedEmail(null);
  };

  const run = async (fn) => {
    setBusy(true);
    setError("");
    setNotice("");
    try { await fn(); }
    catch (err) { setError(err.message); return err; }
    finally { setBusy(false); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === "signup") {
      run(async () => {
        try {
          await signup(name, email, password);
        } catch (err) {
          // Account was created but the email failed — still show the "check inbox" view with a resend option.
          if (err.code !== "EMAIL_SEND_FAILED") throw err;
          setSentTo(email.trim());
          throw err;
        }
        setSentTo(email.trim());
      });
    } else {
      run(async () => {
        try {
          await login(email, password);
          onClose();
        } catch (err) {
          if (err.code === "EMAIL_NOT_VERIFIED") setUnverifiedEmail(email.trim());
          throw err;
        }
      });
    }
  };

  const handleResend = (address) =>
    run(async () => {
      const res = await resendVerification(address);
      setNotice(res.message);
    });

  const handleGoogle = (credential) =>
    run(async () => {
      await loginWithGoogle(credential);
      onClose();
    });

  return (
    <div className="auth-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="auth-card shadow-elevated animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button type="button" className="auth-close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>

        {sentTo ? (
          /* ── Check your inbox ── */
          <div className="auth-sent">
            <div className="auth-sent-icon"><MailIcon /></div>
            <h2 id="auth-title" className="auth-title">Check your email</h2>
            <p className="auth-subtitle">
              We sent a verification link to <strong>{sentTo}</strong>. Click it to activate your account, then sign in.
            </p>
            {error  && <div className="auth-alert auth-alert-error" role="alert">{error}</div>}
            {notice && <div className="auth-alert auth-alert-info" role="status">{notice}</div>}
            <button type="button" className="btn-outline auth-submit" disabled={busy} onClick={() => handleResend(sentTo)}>
              {busy ? "Sending…" : "Resend email"}
            </button>
            <button type="button" className="auth-link" onClick={() => { setSentTo(null); switchMode("login"); }}>
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <h2 id="auth-title" className="auth-title">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h2>
            <p className="auth-subtitle">
              {mode === "signup"
                ? "Sign up with Google or your email address."
                : "Sign in to continue to CiviGuide AI."}
            </p>

            <div className="auth-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={mode === "login"}
                className={`auth-tab ${mode === "login" ? "auth-tab-active" : ""}`} onClick={() => switchMode("login")}>
                Sign in
              </button>
              <button type="button" role="tab" aria-selected={mode === "signup"}
                className={`auth-tab ${mode === "signup" ? "auth-tab-active" : ""}`} onClick={() => switchMode("signup")}>
                Create account
              </button>
            </div>

            {googleClientId && (
              <>
                <div className="auth-google">
                  <GoogleOAuthProvider clientId={googleClientId}>
                    <GoogleLogin
                      onSuccess={(res) => handleGoogle(res.credential)}
                      onError={() => setError("Google sign-in was cancelled or failed. Please try again.")}
                      text={mode === "signup" ? "signup_with" : "signin_with"}
                      shape="rectangular"
                      width="320"
                    />
                  </GoogleOAuthProvider>
                </div>
                <div className="divider-or">
                  <div className="divider-line" />
                  <span className="divider-text">or with email</span>
                  <div className="divider-line" />
                </div>
              </>
            )}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {mode === "signup" && (
                <label className="auth-field">
                  <span className="auth-label">Full name</span>
                  <input ref={firstInputRef} className="auth-input" type="text" autoComplete="name"
                    value={name} onChange={(e) => setName(e.target.value)} required />
                </label>
              )}
              <label className="auth-field">
                <span className="auth-label">Email</span>
                <input ref={mode === "login" ? firstInputRef : undefined} className="auth-input" type="email"
                  autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label className="auth-field">
                <span className="auth-label">Password</span>
                <input className="auth-input" type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={mode === "signup" ? 8 : undefined}
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
                {mode === "signup" && <span className="auth-hint">At least 8 characters.</span>}
              </label>

              {error && (
                <div className="auth-alert auth-alert-error" role="alert">
                  {error}
                  {unverifiedEmail && (
                    <button type="button" className="auth-link auth-link-inline" disabled={busy}
                      onClick={() => handleResend(unverifiedEmail)}>
                      Resend verification email
                    </button>
                  )}
                </div>
              )}
              {notice && <div className="auth-alert auth-alert-info" role="status">{notice}</div>}

              <button type="submit" className="btn-primary auth-submit" disabled={busy}>
                {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

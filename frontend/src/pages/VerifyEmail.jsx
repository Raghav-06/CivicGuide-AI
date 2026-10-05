import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/authContext";

/* ══════════════════════════════════════════════════════════════════════
   Landing page for the link in the verification email (/verify-email?token=…).
   Props:
     onDone()  — continue into the app
   ══════════════════════════════════════════════════════════════════════ */
export default function VerifyEmail({ onDone }) {
  const { verifyEmail, resendVerification } = useAuth();
  const [status,  setStatus]  = useState("verifying");   // verifying | success | error
  const [error,   setError]   = useState("");
  const [email,   setEmail]   = useState("");
  const [notice,  setNotice]  = useState("");
  const [busy,    setBusy]    = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // Tokens are single-use: guard against StrictMode's double effect run.
    if (started.current) return;
    started.current = true;

    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      setError("This verification link is missing its token.");
      return;
    }
    verifyEmail(token)
      .then(() => setStatus("success"))
      .catch((err) => { setStatus("error"); setError(err.message); });
  }, [verifyEmail]);

  const handleResend = async (e) => {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const res = await resendVerification(email);
      setNotice(res.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-root auth-page">
      <div className="auth-card shadow-elevated animate-fade-in">
        {status === "verifying" && (
          <>
            <h1 className="auth-title">Verifying your email…</h1>
            <p className="auth-subtitle">This only takes a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <h1 className="auth-title">Email verified</h1>
            <p className="auth-subtitle">Your account is active and you're signed in.</p>
            <button className="btn-primary auth-submit" onClick={onDone}>Continue to CiviGuide AI</button>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="auth-title">Link not valid</h1>
            {error && <div className="auth-alert auth-alert-error" role="alert">{error}</div>}
            <p className="auth-subtitle">Enter your email and we'll send you a fresh verification link.</p>
            <form className="auth-form" onSubmit={handleResend}>
              <label className="auth-field">
                <span className="auth-label">Email</span>
                <input className="auth-input" type="email" autoComplete="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              {notice && <div className="auth-alert auth-alert-info" role="status">{notice}</div>}
              <button type="submit" className="btn-primary auth-submit" disabled={busy}>
                {busy ? "Sending…" : "Send new link"}
              </button>
            </form>
            <button type="button" className="auth-link" onClick={onDone}>Back to home</button>
          </>
        )}
      </div>
    </div>
  );
}

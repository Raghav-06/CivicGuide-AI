import crypto from "node:crypto";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";

import { query } from "../db/index.js";
import { HttpError, route } from "../http.js";
import { sendVerificationEmail } from "../mailer.js";

const SESSION_COOKIE = "civiguide_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;      // 7 days
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;     // 24 hours
const RESEND_COOLDOWN_MS = 60 * 1000;                // 1 minute between verification emails
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const googleClient = new OAuth2Client();

const router = express.Router();

// Brute-force protection for the credential endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { detail: "Too many attempts. Please try again in a few minutes." },
});

// ── Helpers ─────────────────────────────────────────────────────────────

const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar_url: row.avatar_url,
    email_verified: row.email_verified,
    has_password: Boolean(row.password_hash),
    has_google: Boolean(row.google_id),
  };
}

function startSession(res, user) {
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: SESSION_TTL_MS / 1000 });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

/** Return the logged-in user's row, or null. */
export async function getSessionUser(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  try {
    const { sub } = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await query("SELECT * FROM users WHERE id = $1", [sub]);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** Middleware for routes that need a signed-in user; sets req.user. */
export const requireAuth = route(async (req, res, next) => {
  const user = await getSessionUser(req);
  if (!user) throw new HttpError(401, "Please sign in to continue.");
  req.user = user;
  next();
});

async function issueVerificationEmail(user) {
  const token = crypto.randomBytes(32).toString("base64url");
  await query("DELETE FROM email_verification_tokens WHERE user_id = $1", [user.id]);
  await query(
    "INSERT INTO email_verification_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
    [hashToken(token), user.id, new Date(Date.now() + VERIFY_TOKEN_TTL_MS)],
  );
  const appUrl = (process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");
  const link = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  await sendVerificationEmail({ to: user.email, name: user.name, link });
}

// ── Routes ──────────────────────────────────────────────────────────────

/** Current session. Returns {user: null} rather than 401 so the app can probe on load. */
router.get("/me", route(async (req, res) => {
  const user = await getSessionUser(req);
  res.json({ user: user ? publicUser(user) : null });
}));

/** Public config the frontend needs (e.g. whether Google sign-in is enabled). */
router.get("/config", (req, res) => {
  res.json({ google_client_id: process.env.GOOGLE_CLIENT_ID || null });
});

router.post("/signup", authLimiter, route(async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? "");

  if (!name) throw new HttpError(400, "Please enter your name.");
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "Please enter a valid email address.");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");
  if (password.length > 72) throw new HttpError(400, "Password must be at most 72 characters.");

  const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length) {
    throw new HttpError(409, "An account with this email already exists. Try signing in instead.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const { rows } = await query(
    "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING *",
    [email, name, passwordHash],
  );

  try {
    await issueVerificationEmail(rows[0]);
  } catch (err) {
    console.error("Failed to send verification email:", err);
    throw new HttpError(502,
      "Your account was created, but we couldn't send the verification email. Use \"Resend email\" to try again.",
      "EMAIL_SEND_FAILED");
  }

  res.status(201).json({ message: "Check your inbox to verify your email address.", email });
}));

router.post("/verify-email", authLimiter, route(async (req, res) => {
  const token = String(req.body?.token ?? "");
  if (!token) throw new HttpError(400, "Verification token is missing.");

  const { rows } = await query(
    "DELETE FROM email_verification_tokens WHERE token_hash = $1 RETURNING user_id, expires_at",
    [hashToken(token)],
  );
  const record = rows[0];
  if (!record || record.expires_at < new Date()) {
    throw new HttpError(400, "This verification link is invalid or has expired. Request a new one.", "TOKEN_INVALID");
  }

  const updated = await query(
    "UPDATE users SET email_verified = TRUE, updated_at = now() WHERE id = $1 RETURNING *",
    [record.user_id],
  );
  const user = updated.rows[0];
  if (!user) throw new HttpError(400, "This verification link is invalid or has expired.", "TOKEN_INVALID");

  startSession(res, user);
  res.json({ user: publicUser(user) });
}));

router.post("/resend-verification", authLimiter, route(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  // Same response whether or not the account exists, to avoid leaking which emails are registered.
  const generic = { message: "If that account exists and isn't verified yet, we've sent a new verification email." };

  const { rows } = await query("SELECT * FROM users WHERE email = $1", [email]);
  const user = rows[0];
  if (!user || user.email_verified || !user.password_hash) return res.json(generic);

  const recent = await query(
    "SELECT 1 FROM email_verification_tokens WHERE user_id = $1 AND created_at > $2",
    [user.id, new Date(Date.now() - RESEND_COOLDOWN_MS)],
  );
  if (recent.rows.length) {
    throw new HttpError(429, "Please wait a minute before requesting another email.");
  }

  try {
    await issueVerificationEmail(user);
  } catch (err) {
    console.error("Failed to send verification email:", err);
    throw new HttpError(502, "We couldn't send the verification email. Please try again later.", "EMAIL_SEND_FAILED");
  }
  res.json(generic);
}));

router.post("/login", authLimiter, route(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? "");

  const { rows } = await query("SELECT * FROM users WHERE email = $1", [email]);
  const user = rows[0];
  const ok = user?.password_hash && (await bcrypt.compare(password, user.password_hash));
  if (!ok) {
    if (user && !user.password_hash && user.google_id) {
      throw new HttpError(401, "This account uses Google sign-in. Continue with Google instead.", "USE_GOOGLE");
    }
    throw new HttpError(401, "Invalid email or password.");
  }
  if (!user.email_verified) {
    throw new HttpError(403, "Please verify your email address before signing in.", "EMAIL_NOT_VERIFIED");
  }

  startSession(res, user);
  res.json({ user: publicUser(user) });
}));

router.post("/google", authLimiter, route(async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) throw new HttpError(503, "Google sign-in is not configured.");
  const credential = String(req.body?.credential ?? "");
  if (!credential) throw new HttpError(400, "Missing Google credential.");

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw new HttpError(401, "Google sign-in failed. Please try again.");
  }
  if (!payload?.email || !payload.email_verified) {
    throw new HttpError(401, "Your Google account email isn't verified.");
  }

  const email = normalizeEmail(payload.email);
  let user = (await query("SELECT * FROM users WHERE google_id = $1", [payload.sub])).rows[0];

  if (!user) {
    const byEmail = (await query("SELECT * FROM users WHERE email = $1", [email])).rows[0];
    if (byEmail) {
      // Link Google to the existing account. If that account never verified its email, someone
      // else may have registered it with a password they know — drop the password to prevent takeover.
      user = (await query(
        `UPDATE users SET google_id = $1,
                          avatar_url = COALESCE(avatar_url, $2),
                          name = COALESCE(name, $3),
                          password_hash = CASE WHEN email_verified THEN password_hash ELSE NULL END,
                          email_verified = TRUE,
                          updated_at = now()
         WHERE id = $4 RETURNING *`,
        [payload.sub, payload.picture ?? null, payload.name ?? null, byEmail.id],
      )).rows[0];
    } else {
      user = (await query(
        `INSERT INTO users (email, name, google_id, avatar_url, email_verified)
         VALUES ($1, $2, $3, $4, TRUE) RETURNING *`,
        [email, payload.name ?? null, payload.sub, payload.picture ?? null],
      )).rows[0];
    }
  }

  startSession(res, user);
  res.json({ user: publicUser(user) });
}));

router.post("/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});

export default router;

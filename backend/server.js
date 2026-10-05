/**
 * CiviGuide AI — Express Backend
 * ================================
 * Exposes all 6 engines as REST endpoints for the React frontend.
 *
 * Setup:
 *   npm install
 *   Copy .env.example to .env and fill in the values
 *   (AI_BASE_URL / AI_API_KEY / AI_MODEL, DATABASE_URL, JWT_SECRET, SMTP_*, GOOGLE_CLIENT_ID).
 *
 * Run:
 *   npm start        (or `npm run dev` to restart on file changes)
 *
 * In development the Vite dev server proxies /api and /health here.
 * In production (after `npm run build` in frontend/) this server also serves the built app.
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { analyzeFormDetailed, processAnswer, validateForm, getDocuments, scoreSubmission } from "./src/core.js";
import { readFormBuffer, detectFormType } from "./src/formReader.js";
import { generateFilledPDF } from "./src/formOutput.js";
import { PRESET_FORM_TEXTS } from "./src/presets.js";
import { isEmpty, aiStatus } from "./src/engines/ai.js";
import { answerQuestion } from "./src/engines/assistant.js";
import {
  HttpError, route, readFields, readAnswers, readObject, readField, readText, attachmentHeader,
} from "./src/http.js";
import { migrate } from "./src/db/index.js";
import authRouter, { disabledAuthRouter, requireAuth } from "./src/routes/auth.js";

const PORT = process.env.PORT || 8000;
const APP_URL = (process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");

// ── Accounts (optional) ──────────────────────────────────────────────
// Postgres only backs sign-in. Without it the form flow still works and auth runs in "disabled" mode.
let authEnabled = false;
if (process.env.DATABASE_URL) {
  const secret = process.env.JWT_SECRET ?? "";
  if (!secret) {
    console.error("JWT_SECRET is required when DATABASE_URL is set. See .env.example.");
    process.exit(1);
  }
  if (process.env.NODE_ENV === "production" && (secret === "change_me" || secret.length < 32)) {
    console.error("JWT_SECRET must be a random string of at least 32 characters in production. See .env.example.");
    process.exit(1);
  }
  try {
    await migrate();
    authEnabled = true;
    console.log("Accounts: enabled (Postgres connected)");
  } catch (err) {
    console.warn(`Accounts: disabled — could not connect to Postgres / apply schema (${err.message}). Check DATABASE_URL.`);
  }
} else {
  console.warn("Accounts: disabled — DATABASE_URL is not set. Sign-in is hidden; form filling still works.");
}

// Optional: only signed-in users may call the AI endpoints (protects the AI key from anonymous use).
const REQUIRE_LOGIN_FOR_AI = process.env.REQUIRE_LOGIN_FOR_AI === "true";
if (REQUIRE_LOGIN_FOR_AI && !authEnabled) {
  console.error("REQUIRE_LOGIN_FOR_AI=true needs accounts, but the database isn't available. Set DATABASE_URL or turn it off.");
  process.exit(1);
}

const ai = aiStatus();
if (ai.enabled) {
  console.log(`AI: enabled · ${ai.model} @ ${ai.host}`);
} else {
  console.warn(`AI disabled (${ai.problem}) — the app will run on its offline fallbacks. See .env.example.`);
}

const FRONTEND_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../frontend/dist");

const MAX_UPLOAD_MB = 20;

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 } });

// Behind a reverse proxy (Render, Nginx, …) set TRUST_PROXY so rate limits see client IPs, not the proxy's.
if (process.env.TRUST_PROXY) {
  const hops = Number(process.env.TRUST_PROXY);
  app.set("trust proxy", Number.isInteger(hops) ? hops : process.env.TRUST_PROXY);
}

// ── Cost protection for the AI endpoints ────────────────────────────
const limiter = (windowMinutes, limit, detail) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  limit,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { detail },
});
const aiLimiter = limiter(5, Number(process.env.AI_RATE_LIMIT) || 60,
  "You're sending requests too quickly. Please wait a few minutes and try again.");
const uploadLimiter = limiter(15, Number(process.env.AI_UPLOAD_RATE_LIMIT) || 10,
  "Too many form uploads. Please wait a few minutes before analysing another file.");
/** Middleware for every AI-backed endpoint: rate limit, then (optionally) require sign-in. */
const aiGuard = REQUIRE_LOGIN_FOR_AI ? [aiLimiter, requireAuth] : [aiLimiter];

// Allow the React dev server (port 5173/3000) and any localhost origin
app.use(cors({
  origin: [...new Set([APP_URL, "http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000"])],
  credentials: true,
}));
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

// ══════════════════════════════════════════════════════════════════════════
// ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════

// ── Auth: email/password (with SMTP verification) + Google sign-in ────
app.use("/api/auth", authEnabled ? authRouter : disabledAuthRouter);

/** Health check — confirms server is running. */
app.get("/health", (req, res) => {
  const { enabled, host, model } = aiStatus();
  res.json({
    status: "ok", message: "CiviGuide AI backend is running",
    ai_enabled: enabled, ai_host: host, ai_model: model,
    auth_enabled: authEnabled, ai_requires_login: REQUIRE_LOGIN_FOR_AI,
  });
});

/** Run Engines 1+2, turning failures into errors the user can act on. */
async function analyzeOrExplain(formText) {
  try {
    return await analyzeFormDetailed(formText);
  } catch (err) {
    if (err.message.startsWith("No form fields")) throw new HttpError(422, err.message);
    console.error("Form analysis failed:", err);
    throw new HttpError(502, "AI form analysis is unavailable right now. Please try again in a moment.");
  }
}

// Preset texts never change, so their analysis is cached after the first success.
const presetCache = new Map();

// ── Engine 1+2: Analyze a preset form by name ─────────────────────────
app.post("/api/analyze-preset", aiGuard, route(async (req, res) => {
  const formName = req.body?.form_name;
  const formText = PRESET_FORM_TEXTS[formName];
  if (!formText) throw new HttpError(404, `Unknown preset form: ${formName}`);

  if (!presetCache.has(formName)) presetCache.set(formName, await analyzeOrExplain(formText));
  const { fields, notice } = presetCache.get(formName);
  res.json({ form_fields: fields, form_name: formName, notice });
}));

// ── Engine 1+2: Analyze an uploaded PDF or DOCX ──────────────────────
app.post("/api/analyze-pdf", uploadLimiter, aiGuard, upload.single("file"), route(async (req, res) => {
  const file = req.file;
  if (!file) throw new HttpError(400, "Please choose a PDF or DOCX file to upload.");
  // Decided by the file's content (and MIME type / extension), so a misnamed file still works.
  if (!detectFormType(file.buffer, file.originalname, file.mimetype)) {
    throw new HttpError(400, "Only PDF and DOCX files are accepted.");
  }

  let formText;
  try {
    formText = await readFormBuffer(file.buffer, file.originalname, file.mimetype);
  } catch (err) {
    if (err.code === "PDF_PASSWORD") {
      throw new HttpError(422, "This PDF is password-protected. Remove the password (e.g. print it to a new PDF) and upload it again.");
    }
    if (err.code === "PDF_CORRUPT" || err.code === "DOCX_CORRUPT") {
      throw new HttpError(422, "This file seems to be damaged or isn't a real PDF/DOCX. Try exporting it again and re-uploading.");
    }
    console.warn("Form read failed:", err);
    throw new HttpError(422, `Couldn't read this file: ${err.message}`);
  }
  if (formText.length < 20) {
    throw new HttpError(422, "No text found in this file. If it's a scanned image, upload a text-based PDF or DOCX instead.");
  }

  const { fields, notice } = await analyzeOrExplain(formText);
  res.json({ form_fields: fields, form_name: file.originalname, notice });
}));

// ── Assistant: free-form questions about forms and documents ─────────
app.post("/api/ask", aiGuard, route(async (req, res) => {
  const question = readText(req.body, "question", { label: "your question" });
  const formName = typeof req.body?.form_name === "string" ? req.body.form_name.slice(0, 200) : undefined;
  const field = req.body?.field ? readField(req.body) : undefined;

  try {
    const answer = await answerQuestion(question, { formName, field });
    res.json({ answer });
  } catch (err) {
    console.error("ask failed:", err);
    throw new HttpError(502, "The assistant is unavailable right now. Please try again in a moment.");
  }
}));

// ── Engine 2+3: Process a single answer ──────────────────────────────
app.post("/api/process-answer", aiGuard, route(async (req, res) => {
  const field = readField(req.body);
  const user_input = readText(req.body, "user_input", { label: "your answer" });
  const form_fields = readFields(req.body);
  const context = readAnswers(req.body, "context");
  try {
    res.json(await processAnswer(field, user_input, form_fields, context));
  } catch (err) {
    // Graceful fallback — don't break the conversation
    console.error("process-answer failed:", err);
    res.json({
      primary_field: { [field.field ?? "unknown"]: user_input },
      derived_fields: {},
      confidence: 0.75,
      uncertainty_detected: false,
      clarification_needed: false,
      clarification_question: null,
    });
  }
}));

// ── Engine 4: Validate form ───────────────────────────────────────────
app.post("/api/validate", aiGuard, route(async (req, res) => {
  const form_fields = readFields(req.body);
  const filled_answers = readAnswers(req.body);
  try {
    res.json(await validateForm(form_fields, filled_answers));
  } catch (err) {
    console.error("validate failed:", err);
    res.json({ errors: [], warnings: [], is_valid: true, error_count: 0, warning_count: 0 });
  }
}));

// ── Engine 5: Document recommendations ───────────────────────────────
app.post("/api/documents", aiGuard, route(async (req, res) => {
  const form_fields = readFields(req.body);
  const filled_answers = readAnswers(req.body);
  try {
    res.json(await getDocuments(form_fields, filled_answers));
  } catch (err) {
    console.error("documents failed:", err);
    res.json({
      required_documents: [
        { name: "Identity Proof", reason: "Required for all applications", mandatory: true },
        { name: "Address Proof", reason: "Required for all applications", mandatory: true },
      ],
      summary: "Please prepare standard identity and address proof documents.",
      estimated_processing_time: "7–10 working days",
      tips: ["Keep photocopies of all documents.", "Verify details before submission."],
    });
  }
}));

// ── Engine 6: Score submission ────────────────────────────────────────
app.post("/api/score", aiGuard, route(async (req, res) => {
  const form_fields = readFields(req.body);
  const filled_answers = readAnswers(req.body);
  const validation_result = readObject(req.body, "validation_result");
  try {
    res.json(await scoreSubmission(form_fields, filled_answers, validation_result));
  } catch (err) {
    console.error("score failed:", err);
    const filledCount = form_fields.filter((f) => !isEmpty(filled_answers[f.field])).length;
    const total = Math.max(form_fields.length, 1);
    const pct = Math.trunc((filledCount / total) * 100);
    res.json({
      submission_confidence_score: pct,
      risk_level: pct >= 80 ? "low" : pct >= 55 ? "medium" : "high",
      breakdown: [`${pct}% fields completed`],
      recommendation: "Review all fields before submitting.",
      suspicious_patterns: [],
      completion_rate: pct,
    });
  }
}));

// ── PDF generation + download ─────────────────────────────────────────
app.post("/api/generate-pdf", route(async (req, res) => {
  const form_fields = readFields(req.body);
  const filled_answers = readAnswers(req.body);
  const document_checklist = readObject(req.body, "document_checklist");
  const rawName = req.body?.form_name;
  const formName = (rawName === undefined || rawName === null ? "" : String(rawName)).trim().slice(0, 120) || "Government Form";

  let pdf;
  try {
    pdf = await generateFilledPDF(form_fields, filled_answers, document_checklist);
  } catch (err) {
    throw new HttpError(500, `PDF generation failed: ${err.message}`);
  }
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": attachmentHeader(`${formName.replace(/[\s/\\]+/g, "_")}_CiviGuide.pdf`),
  });
  res.send(pdf);
}));

// ── Error handler — renders {"detail": "...", "code"?: "..."} ─────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    err = err.code === "LIMIT_FILE_SIZE"
      ? new HttpError(413, `File is too large. Maximum is ${MAX_UPLOAD_MB} MB.`)
      : new HttpError(400, err.code === "LIMIT_UNEXPECTED_FILE"
        ? "Upload a single file in the 'file' field."
        : `Upload failed: ${err.message}`);
  }
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json(status >= 500 && !err.status
    ? { detail: "Internal server error" }
    : { detail: err.message, ...(err.code && { code: err.code }) });
});

// ── Built frontend (production) ───────────────────────────────────────
if (existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  // Client-side routes (e.g. /verify-email) all load index.html.
  app.get(/^\/(?!api\/|health$).*/,(req, res) => res.sendFile(path.join(FRONTEND_DIST, "index.html")));
}

app.listen(PORT, () => {
  console.log(`CiviGuide AI backend listening on http://localhost:${PORT}`);
});

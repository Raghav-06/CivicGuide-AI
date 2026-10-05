/**
 * CiviGuide AI — Express Backend
 * ================================
 * Exposes all 6 engines as REST endpoints for the React frontend.
 *
 * Setup:
 *   npm install
 *   Copy .env.example to .env and fill in the values
 *   (AI_PROVIDER / AI_API_KEY / AI_MODEL, DATABASE_URL, JWT_SECRET, SMTP_*, GOOGLE_CLIENT_ID).
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
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { analyzeForm, processAnswer, validateForm, getDocuments, scoreSubmission } from "./src/core.js";
import { readFormBuffer } from "./src/formReader.js";
import { generateFilledPDF } from "./src/formOutput.js";
import { PRESET_FORM_TEXTS } from "./src/presets.js";
import { isEmpty, aiStatus } from "./src/engines/ai.js";
import { answerQuestion } from "./src/engines/assistant.js";
import { HttpError, route } from "./src/http.js";
import { migrate } from "./src/db/index.js";
import authRouter, { disabledAuthRouter } from "./src/routes/auth.js";

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

const ai = aiStatus();
if (ai.enabled) {
  console.log(`AI: ${ai.provider} · ${ai.model}`);
} else {
  console.warn(`AI disabled (${ai.problem}) — the app will run on its offline fallbacks. See .env.example.`);
}

const FRONTEND_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../frontend/dist");

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

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
  const { enabled, provider, model } = aiStatus();
  res.json({
    status: "ok", message: "CiviGuide AI backend is running",
    ai_enabled: enabled, ai_provider: provider, ai_model: model, auth_enabled: authEnabled,
  });
});

/** Run Engines 1+2, turning failures into errors the user can act on. */
async function analyzeOrExplain(formText) {
  try {
    return await analyzeForm(formText);
  } catch (err) {
    if (err.message.startsWith("No form fields")) throw new HttpError(422, err.message);
    console.error("Form analysis failed:", err);
    throw new HttpError(502, "AI form analysis is unavailable right now. Please try again in a moment.");
  }
}

// Preset texts never change, so their analysis is cached after the first success.
const presetCache = new Map();

// ── Engine 1+2: Analyze a preset form by name ─────────────────────────
app.post("/api/analyze-preset", route(async (req, res) => {
  const formName = req.body?.form_name;
  const formText = PRESET_FORM_TEXTS[formName];
  if (!formText) throw new HttpError(404, `Unknown preset form: ${formName}`);

  if (!presetCache.has(formName)) presetCache.set(formName, await analyzeOrExplain(formText));
  res.json({ form_fields: presetCache.get(formName), form_name: formName });
}));

// ── Engine 1+2: Analyze an uploaded PDF or DOCX ──────────────────────
app.post("/api/analyze-pdf", upload.single("file"), route(async (req, res) => {
  const file = req.file;
  if (!file || !/\.(pdf|docx)$/i.test(file.originalname)) {
    throw new HttpError(400, "Only PDF and DOCX files are accepted.");
  }

  let formText;
  try {
    formText = await readFormBuffer(file.buffer, file.originalname);
  } catch (err) {
    throw new HttpError(422, `Couldn't read this file: ${err.message}`);
  }
  if (formText.length < 20) {
    throw new HttpError(422, "No text found in this file. If it's a scanned image, upload a text-based PDF or DOCX instead.");
  }

  const fields = await analyzeOrExplain(formText);
  res.json({ form_fields: fields, form_name: file.originalname });
}));

// ── Assistant: free-form questions about forms and documents ─────────
app.post("/api/ask", route(async (req, res) => {
  const question = String(req.body?.question ?? "").trim();
  if (!question) throw new HttpError(400, "Please type a question.");
  if (question.length > 1000) throw new HttpError(400, "Please keep your question under 1000 characters.");

  try {
    const answer = await answerQuestion(question, { formName: req.body?.form_name, field: req.body?.field });
    res.json({ answer });
  } catch (err) {
    console.error("ask failed:", err);
    throw new HttpError(502, "The assistant is unavailable right now. Please try again in a moment.");
  }
}));

// ── Engine 2+3: Process a single answer ──────────────────────────────
app.post("/api/process-answer", route(async (req, res) => {
  const { field = {}, user_input, form_fields = [], context = {} } = req.body ?? {};
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
app.post("/api/validate", route(async (req, res) => {
  const { form_fields = [], filled_answers = {} } = req.body ?? {};
  try {
    res.json(await validateForm(form_fields, filled_answers));
  } catch (err) {
    console.error("validate failed:", err);
    res.json({ errors: [], warnings: [], is_valid: true, error_count: 0, warning_count: 0 });
  }
}));

// ── Engine 5: Document recommendations ───────────────────────────────
app.post("/api/documents", route(async (req, res) => {
  const { form_fields = [], filled_answers = {} } = req.body ?? {};
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
app.post("/api/score", route(async (req, res) => {
  const { form_fields = [], filled_answers = {}, validation_result = {} } = req.body ?? {};
  try {
    res.json(await scoreSubmission(form_fields, filled_answers, validation_result));
  } catch (err) {
    console.error("score failed:", err);
    const filledCount = Object.values(filled_answers).filter((v) => !isEmpty(v)).length;
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
  const {
    form_fields = [], filled_answers = {}, document_checklist = {}, form_name = "Government Form",
  } = req.body ?? {};
  const safeName = form_name.replace(/[\s/]/g, "_");

  let pdf;
  try {
    pdf = await generateFilledPDF(form_fields, filled_answers, document_checklist);
  } catch (err) {
    throw new HttpError(500, `PDF generation failed: ${err.message}`);
  }
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${safeName}_CiviGuide.pdf"`,
  });
  res.send(pdf);
}));

// ── Error handler — renders {"detail": "...", "code"?: "..."} ─────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
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

# CiviGuide AI
### Intelligent Government Form Auto-Navigator & Error Prevention System

> Instead of citizens adapting to bureaucracy, bureaucracy adapts to citizens.

---

## 🧠 Overview

CiviGuide AI is an Automated Adaptation system that transforms complex government forms into intelligent conversational interfaces.

It simplifies legal language, maps natural language responses into structured official data, validates inputs automatically, and generates submission-ready documents — without requiring manual bureaucratic understanding from citizens.

---

## 🎯 Problem Statement

Government forms are:
- Legally complex
- Structurally rigid
- Error-sensitive
- Often rejected for minor mistakes
- Hard to interpret

Citizens must manually:
- Understand legal terminology
- Convert answers into structured fields
- Validate compliance
- Identify required documents

This creates inefficiency and exclusion.

---

## 🚀 Solution

CiviGuide AI automates:

- Legal language interpretation
- Conversational simplification
- Natural language to structured field mapping
- Logical validation & compliance checks
- Document recommendation generation
- Submission-ready form output

It shifts the adaptation burden from humans to software.

---

## 🏗 System Architecture

### 1️⃣ Form Understanding Layer
Stores official forms as structured schemas:
- Field name
- Data type
- Required status
- Validation rules
- Dependencies
- Required documents

### 2️⃣ Conversational Simplification Engine
Rewrites legal language into human-friendly questions.

Example:

Original:
"Have you engaged in remunerative employment during the preceding fiscal year?"

Simplified:
"Did you earn money last year?"

---

### 3️⃣ Intelligent Field Mapping Engine
Converts natural language responses into structured JSON.

Example:
User Input:
"I earn around 20 thousand per month."

Generated:
```json
{
  "monthly_income": 20000,
  "annual_income": 240000
}
```

---

### 4️⃣ Logical Validation Engine
Checks every answer before submission: required fields, formats (dates as DD/MM/YYYY, phone numbers, emails, numbers, select options) and cross-field logic such as age requirements, income vs. employment status, or an end date before a start date.

### 5️⃣ Document Recommendation Engine
Builds a personalised checklist of supporting documents from the filled answers (e.g. self-employed → income proof and tax returns; married → marriage certificate), with the reason for each, submission tips and an estimated processing time.

### 6️⃣ Submission Confidence Scorer
Produces a 0–100 confidence score and a low / medium / high risk level from completion, validation errors and warnings, plus a one-line recommendation — so problems are fixed before the form is submitted, not after it is rejected.

The result is downloaded as a PDF containing the filled answers and the document checklist (₹ and Devanagari text are supported).

---

## ⚙️ Getting Started

```bash
npm run setup                          # install root, backend and frontend dependencies
cp backend/.env.example backend/.env   # then fill it in (see below) — every setting is optional
npm run dev                            # backend on :8000 + frontend on :5173
```

Open http://localhost:5173. The Vite dev server proxies `/api` to the backend, so both run as one app.

### What works with which setup

| Setup | What you get |
|---|---|
| **No AI key, no Postgres** | The four ready-made forms, filled with built-in rules (amounts like "20k" or "1.5 lakh", dates, phone numbers and options are understood), local validation and scoring, standard document checklists, and the PDF download. No sign-in button. |
| **+ AI provider** | Uploading your own PDF/DOCX form, AI question simplification, answer understanding, cross-field validation, personalised documents and scoring, and the "help" assistant. **Uploading your own form needs AI.** |
| **+ Postgres** | Accounts: email sign-up with verification, password sign-in and (optionally) Google sign-in. Postgres is used only for accounts. |

### Settings (`backend/.env`)
- **AI** — `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`: any provider (OpenAI, Anthropic, Groq, Gemini, OpenRouter, Together, Mistral, DeepSeek, xAI, Ollama, or any OpenAI-compatible server via `custom` + `AI_BASE_URL`) and any model it serves. Without them the app uses its built-in rules.
- **Accounts (optional)** — `DATABASE_URL` (PostgreSQL; tables are created on startup) and `JWT_SECRET`, which is required only when `DATABASE_URL` is set. With `NODE_ENV=production` the server refuses to start if `JWT_SECRET` is `change_me` or shorter than 32 characters. If the database is missing or unreachable, the server still starts with accounts disabled.
- **Email verification** — `SMTP_*` (optional in development: verification links are printed to the console).
- **Google sign-in** — `GOOGLE_CLIENT_ID` (optional).
- **AI cost protection** — every AI endpoint is rate-limited per IP:
  - `AI_RATE_LIMIT` — requests per 5 minutes (default 60).
  - `AI_UPLOAD_RATE_LIMIT` — form uploads per 15 minutes (default 10).
  - `REQUIRE_LOGIN_FOR_AI=true` — only signed-in users may use the AI endpoints (requires Postgres); signed-out users get the built-in rules. Off by default so the demo works without accounts.
  - `TRUST_PROXY` — behind a reverse proxy, set to the number of proxy hops (usually `1`) so limits apply per client rather than to the proxy.

Production: `npm run build` then `npm start` — the backend serves the built frontend on one port.

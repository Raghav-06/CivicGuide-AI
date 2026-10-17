# CiviGuide AI
### A guide to Indian government applications — rules, steps, fields and documents

> Instead of citizens adapting to bureaucracy, bureaucracy adapts to citizens.

---

## 🧠 Overview

CiviGuide AI is an assistant for Indian government applications: certificates, ID cards, licences, agreements, affidavits, exam and job applications, welfare schemes and tax. For each one it explains the rules, the online and offline process, what to enter in every field and which documents to keep ready.

**CiviGuide never fills in or submits the official form.** It shows what each field needs (format, example, where to find the value), checks your own values if you want, and gives you a checklist and a preparation sheet to copy from. You fill the real form yourself on the official portal or on paper.

## ✨ What's inside

- **Explore services** (`/explore`) — instant search across 29 hand-written guides, matching English names, Hindi names and keywords (try *rent*, *kiraya*, *किराया*, *licence*, *neet*, *caste*), with category tiles, an online/offline filter and match highlighting. If nothing matches, **Ask CiviGuide** writes a guide with AI, always badged *AI-generated — verify on the official site*; without AI it shows the closest catalogue entries.
- **Service guides** (`/services/<id>`) — overview with the official portal, indicative fees and timelines and a state selector; an eligibility tick-list; an animated step-by-step tracker (online and offline steps look different); one card per field with format, example, where to find it, common mistakes and a live **Check my value** box (runs in the browser only); a document checklist that adapts to yes/no questions such as *"Is the applicant under 18?"*, with a progress ring; rules, common rejections and tips; and a question box. Progress is saved per service in your browser.
- **Preparation sheet PDF** — *"Application Preparation Sheet — not an official form"*, with the official link, steps, every field with its format and your checked value, and your document checklist with ticks. ID numbers (Aadhaar, PAN, Voter ID) are never sent to the server or printed.
- **Your own form or link** — upload a PDF/DOCX or paste a link to an online form or notice. CiviGuide lists the details it asks for, checks each value with you in a chat, and shows a **Rules & requirements** panel (eligibility, documents, fees, deadlines, photo/signature specs, how to submit) read from the same text. The result is a list of *values to copy into the official form* and a preparation sheet.
- **English / हिन्दी** toggle for the navigation, Explore and guide pages. Catalogue body text is English for now; service names have Hindi versions (`name_hi`).

> CiviGuide gives general guidance. Rules, fees and documents can change and may differ by state — always confirm on the official website or office before applying.

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
- A preparation sheet of checked values to copy into the official form

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

The result is downloaded as a preparation sheet — your checked values to copy into the official form, the form's rules & requirements and the document checklist (₹ and Devanagari text are supported). It is not the official form.

---

## 📚 The service catalogue

The knowledge base lives in `shared/catalog/` — plain ES modules used by both the backend and the frontend:

| File | Contents |
|---|---|
| `index.js` | The entry shape (JSDoc), `SERVICES`, `CATEGORIES`, `STATES_AND_UTS`, `searchServices`, `highlightParts`, `checklistFor`, `findInService`, `isOfficialUrl` |
| `identity.js`, `certificates.js`, `licences.js`, `vehicle.js`, `property-agreements.js`, `affidavits.js`, `education-exams.js`, `jobs.js`, `welfare-schemes.js`, `tax-finance.js`, `business.js` | One module per category |
| `catalog.test.js` | Checks every entry (run with `npm test`) |

### Adding a service

1. Pick the category module (or add a category to `CATEGORIES` in `index.js` and a new module).
2. Add an entry with every key listed in the JSDoc at the top of `index.js`: `id` (unique kebab-case), `name`, `name_hi`, `keywords` (include Hindi/Hinglish words people type), `steps`, `fields`, `documents`, `conditions`, `rules`, and so on.
3. Field `type` must be one of `text, number, date, email, phone, select, boolean, url`. Give each field an `example` — the tests check that it passes `checkAnswer`, so the guide never contradicts its own checker.
4. A document that applies only sometimes goes in `documents` **and** in a condition's `adds_documents`; it then appears only when the user answers "yes".
5. Run `npm test`.

### Accuracy rules

- Only state facts you are confident are generally true. Where rules, fees or stamp duty differ by state, set `state_specific: true`, explain the general pattern in `state_notes` and say it varies by state — **never invent a state-specific number**.
- `fees` and `timeline` always start with *"Indicative only"* (the tests enforce this).
- `official_url` must be a real, well-known government portal over https on a `.gov.in`, `.nic.in` or `.gov` host — otherwise `null`. Don't guess URLs. (NTA's `nta.ac.in` is official but fails this rule, so that entry uses `null` and names the site in its steps.)
- Agreements and affidavits cover stamp paper / e-stamp, registration vs notarisation and witnesses, set `legal_note: true`, and include a rule saying it is *general information, not legal advice*.
- Update `last_reviewed` when you check an entry against official sources.

AI-written guides (`POST /api/guide`) follow the same shape; the server validates them, drops any `official_url` that isn't a government host, labels fees as indicative, and marks them `ai_generated: true`.

### API

| Endpoint | |
|---|---|
| `GET /api/catalog` | Compact list for search and browsing |
| `GET /api/catalog/:id` | Full entry, or 404 |
| `POST /api/guide` `{ query }` | AI guide for a service not in the catalogue (rate-limited); without AI, the closest matches |
| `POST /api/guide` `{ id, question }` | Short answer about a catalogue service; without AI, the matching guide lines |
| `POST /api/prep-sheet` | Preparation-sheet PDF for a guide (values re-checked, ID numbers dropped) |
| `POST /api/analyze-pdf`, `/api/analyze-url` | Form fields **and** `requirements` (eligibility, rules, documents, fees, deadlines, photo_signature_specs, submission), extracted in parallel |

---

## ⚙️ Getting Started

```bash
npm run setup                          # install root, backend and frontend dependencies
cp backend/.env.example backend/.env   # then fill it in (see below) — every setting is optional
npm run dev                            # backend on :8000 + frontend on :5173
npm test                               # catalogue tests (node --test)
```

Open http://localhost:5173. The Vite dev server proxies `/api` to the backend, so both run as one app.

### What works with which setup

| Setup | What you get |
|---|---|
| **No AI key, no Postgres** | Explore, search, every service guide, checklists, "Check my value" and the preparation-sheet PDF (all from the catalogue). The four ready-made forms, filled with built-in rules (amounts like "20k" or "1.5 lakh", dates, phone numbers and options are understood), local validation and scoring, standard document checklists, and the PDF download. No sign-in button. |
| **+ AI provider** | Guides for services not in the catalogue, AI answers in the guide's question box, rules & requirements read from your own form, uploading your own PDF/DOCX form, AI question simplification, answer understanding, cross-field validation, personalised documents and scoring, and the "help" assistant. **Uploading your own form needs AI.** |
| **+ Postgres** | Accounts: email sign-up with verification, password sign-in and (optionally) Google sign-in. Postgres is used only for accounts. |

### Settings (`backend/.env`)
- **AI** — `AI_BASE_URL` and `AI_MODEL` (required to enable AI) plus `AI_API_KEY` if the API needs one. Any OpenAI-compatible `/chat/completions` API works (Groq, OpenAI, Gemini, OpenRouter, Together, Mistral, DeepSeek, xAI, Ollama, LM Studio, …); `.env.example` lists their base URLs and a complete Groq example. For Anthropic, set `AI_API_STYLE=anthropic` (then `AI_API_KEY` is required). Optional: `AI_MAX_TOKENS`, `AI_EFFORT`, `AI_TIMEOUT_MS`. Without `AI_BASE_URL`/`AI_MODEL` the app uses its built-in rules.
- **Accounts (optional)** — `DATABASE_URL` (PostgreSQL; tables are created on startup) and `JWT_SECRET`, which is required only when `DATABASE_URL` is set. With `NODE_ENV=production` the server refuses to start if `JWT_SECRET` is `change_me` or shorter than 32 characters. If the database is missing or unreachable, the server still starts with accounts disabled.
- **Email verification** — `SMTP_*` (optional in development: verification links are printed to the console).
- **Google sign-in** — `GOOGLE_CLIENT_ID` (optional).
- **AI cost protection** — every AI endpoint is rate-limited per IP:
  - `AI_RATE_LIMIT` — requests per 5 minutes (default 60).
  - `AI_UPLOAD_RATE_LIMIT` — form uploads per 15 minutes (default 10).
  - `REQUIRE_LOGIN_FOR_AI=true` — only signed-in users may use the AI endpoints (requires Postgres); signed-out users get the built-in rules. Off by default so the demo works without accounts.
  - `TRUST_PROXY` — behind a reverse proxy, set to the number of proxy hops (usually `1`) so limits apply per client rather than to the proxy.

Production: `npm run build` then `npm start` — the backend serves the built frontend on one port.

🧠 CiviGuide AI: Backend Inference Engine
The intelligence layer for automated bureaucratic adaptation.

This repository contains the backend processing pipeline for CiviGuide AI. It is designed to ingest raw government forms (PDF/DOCX), understand their constraints, dynamically interview users in plain English, and output perfectly structured, highly confident PDF submissions.

🚀 The "Automated Adaptation" Pipeline
To safely handle government compliance, we don't rely on a single LLM prompt. Instead, we use a deterministic 6-Engine Architecture where each step has a specific, isolated responsibility, outputting strict JSON schema.

1️⃣ The Simplifier Engine (src/engines/simplifier.js)
Ingestion: Reads raw text from PDFs or DOCX files.

Action: Extracts the underlying form schema and actively rewrites complex legal jargon into simple, conversational questions.

2️⃣ The Extractor Engine (src/engines/extractor.js)
Action: Parses natural language user input ("I make about twenty thousand a month") and extracts the raw values, calculating a confidence score and flagging uncertainty for clarification.

3️⃣ The Mapper Engine (src/engines/mapper.js)
Action: Maps the extracted entities to the rigid form schema.

Smart Derivation: Automatically calculates derived fields (e.g., extrapolating annual_income from a monthly_income answer).

4️⃣ The Validator Engine (src/engines/validator.js)
Action: Runs cross-field logical checks to prevent immediate rejection (e.g., throwing an error if age < 18 but applying for a commercial license).

5️⃣ The Document Recommender (src/engines/documents.js)
Action: Analyzes the filled schema to generate a personalized, dynamic checklist of required supporting documents, including "why" they are needed and processing time estimates.

6️⃣ The Scorer Engine (src/engines/scorer.js)
Action: Calculates a final Submission Confidence Score (0-100) and a Risk Level (Low/Medium/High) based on completion rates, warnings, and AI qualitative assessment.

🛠️ Tech Stack & Integrations
Runtime: Node.js 18+ (ES modules)

API Server: Express (server.js), with multer for PDF uploads and cors for the Vite dev server.

LLM Inference: provider-neutral (src/engines/ai.js), configured only through environment variables — AI_BASE_URL + AI_MODEL (+ AI_API_KEY if the API needs one) for any OpenAI-compatible /chat/completions API (Groq, OpenAI, Gemini, OpenRouter, Together, Mistral, DeepSeek, xAI, Ollama, LM Studio, …), or AI_API_STYLE=anthropic to use the Anthropic SDK.

Document Parsing: unpdf (PDFs) and mammoth (DOCX).

PDF Generation: pdfkit with bundled Noto Sans / Noto Sans Devanagari fonts (assets/fonts, SIL OFL) so ₹ and Hindi text render, for compiling the final, structured, submission-ready PDF complete with tables and checklists.

Database (optional): PostgreSQL via pg, used only for accounts — users and email-verification tokens; tables are created automatically on startup (src/db/schema.sql). Without it the server runs with accounts disabled.

Auth: bcryptjs password hashing, JWT session in an httpOnly cookie, nodemailer (SMTP) for email verification, google-auth-library for Google sign-in.

⚙️ Installation & Setup
Install dependencies:

Bash
cd backend
npm install
(Optional, for accounts) Create the database (PostgreSQL 13+):

Bash
psql -U postgres -c "CREATE DATABASE civiguide;"
Configure Environment Variables:
Copy .env.example to .env and fill it in. Every setting is optional:

What works with which setup:
- No AI key, no Postgres: the ready-made (preset) forms work end to end with built-in rules — local answer parsing, validation, scoring, standard document checklists — and PDF generation. Sign-in is hidden.
- With AI (AI_BASE_URL and AI_MODEL, plus AI_API_KEY if the API needs one — any OpenAI-compatible API such as Groq, OpenAI, Gemini, OpenRouter, Together, Mistral, DeepSeek, xAI, Ollama or LM Studio; set AI_API_STYLE=anthropic for Anthropic, which also requires AI_API_KEY; .env.example lists example base URLs): all six engines run here, and users can upload their own PDF/DOCX forms. Uploading your own form needs AI.
- With Postgres (DATABASE_URL + JWT_SECRET): accounts. JWT_SECRET is required only when DATABASE_URL is set; with NODE_ENV=production it must not be "change_me" and must be at least 32 characters. If the database can't be reached, the server logs a warning and starts with accounts disabled.

AI cost protection:
- Every AI endpoint is rate-limited per IP: AI_RATE_LIMIT requests per 5 minutes (default 60), and /api/analyze-pdf AI_UPLOAD_RATE_LIMIT per 15 minutes (default 10).
- REQUIRE_LOGIN_FOR_AI=true allows only signed-in users to call the AI endpoints (needs the database; the server refuses to start without it). Default off.
- TRUST_PROXY: behind a reverse proxy, set to the number of proxy hops (usually 1) so rate limits see client IPs.

SMTP_* — the server that sends verification emails. With Gmail, use smtp.gmail.com, port 465, SMTP_SECURE=true and a Google App Password (not your normal password). If SMTP_HOST is left empty in development, the verification link is printed to the server console instead.

GOOGLE_CLIENT_ID — create an OAuth 2.0 Client ID (type "Web application") in Google Cloud Console → APIs & Services → Credentials, and add your frontend URL (http://localhost:5173) under "Authorized JavaScript origins". No client secret or redirect URI is needed. Leave it empty to hide the Google button.

APP_URL — the frontend URL; used for CORS and for the link in verification emails.

🌐 Running the API Server
Bash
npm start        # or: npm run dev (restarts on file changes)
Endpoints (all JSON unless noted):

GET  /health               → { ai_enabled, ai_host, ai_model, auth_enabled, ai_requires_login }
POST /api/analyze-preset   { form_name } → { form_fields, form_name, notice }
POST /api/analyze-pdf      multipart/form-data, field "file" (PDF or DOCX, max 20 MB) → { form_fields, form_name, notice }
POST /api/ask              { question, field?, form_name? } → { answer }
POST /api/process-answer   { field, user_input, form_fields, context }
POST /api/validate         { form_fields, filled_answers }
POST /api/documents        { form_fields, filled_answers }
POST /api/score            { form_fields, filled_answers, validation_result }
POST /api/generate-pdf     { form_fields, filled_answers, document_checklist, form_name } → application/pdf

Auth (session is an httpOnly cookie; send requests with credentials):

GET  /api/auth/me                    → { user } (null when signed out)
GET  /api/auth/config                → { google_client_id, auth_enabled }
POST /api/auth/signup                { name, email, password } → sends verification email
POST /api/auth/verify-email          { token } → verifies + signs in
POST /api/auth/resend-verification   { email }
POST /api/auth/login                 { email, password } → 403 code EMAIL_NOT_VERIFIED until verified
POST /api/auth/google                { credential } (Google ID token)
POST /api/auth/logout

Without a database, /api/auth/me returns { user: null }, /api/auth/config returns { google_client_id: null, auth_enabled: false }, and every other auth endpoint returns 503.

Errors are JSON { detail }. Malformed request bodies get 400, uploads over 20 MB get 413, and rate-limited requests get 429. `notice` is set when part of a very long form could not be analysed.

💻 Running the Interactive Demo
This repository includes a fully functional, interactive terminal interface to test the 6-engine pipeline.

Bash
npm run demo
CLI Commands:
fill: Initiates the form-filling pipeline. You will be prompted to provide a PDF path, a DOCX path, load the bundled sample form (sample_form.txt, a simplified ITR-1), or paste raw text. The AI will then conduct a dynamic interview to fill the form.

General Q&A: Type any question regarding government processes, visas, or documents, and the AI will act as a bureaucratic expert.

quit: Exits the application.

📂 Output
Upon completing an interview, the system uses pdfkit to generate a professional PDF (default: filled_form.pdf) containing:

All mapped applicant information.

A structured Document Checklist (Mandatory vs. Optional).

Submission Tips and Estimated Processing Times.

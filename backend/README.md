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

LLM Inference: provider-neutral (src/engines/ai.js) — any model from OpenAI, Anthropic, Groq, Gemini, OpenRouter, Together, Mistral, DeepSeek, xAI, Ollama or any OpenAI-compatible server, chosen with AI_PROVIDER / AI_MODEL.

Document Parsing: unpdf (PDFs) and mammoth (DOCX).

PDF Generation: pdfkit for compiling the final, structured, submission-ready PDF complete with tables and checklists.

Database: PostgreSQL via pg. Users and email-verification tokens; tables are created automatically on startup (src/db/schema.sql).

Auth: bcryptjs password hashing, JWT session in an httpOnly cookie, nodemailer (SMTP) for email verification, google-auth-library for Google sign-in.

⚙️ Installation & Setup
Install dependencies:

Bash
cd backend
npm install
Create the database (PostgreSQL 13+):

Bash
psql -U postgres -c "CREATE DATABASE civiguide;"
Configure Environment Variables:
Copy .env.example to .env and fill it in. Required: DATABASE_URL, JWT_SECRET. For AI features also set AI_PROVIDER, AI_API_KEY and AI_MODEL — any supported provider and any model it serves (OpenAI, Anthropic, Groq, Gemini, OpenRouter, Together, Mistral, DeepSeek, xAI, Ollama, or any OpenAI-compatible server via AI_PROVIDER=custom + AI_BASE_URL). Without them the app runs on its offline fallbacks.

SMTP_* — the server that sends verification emails. With Gmail, use smtp.gmail.com, port 465, SMTP_SECURE=true and a Google App Password (not your normal password). If SMTP_HOST is left empty in development, the verification link is printed to the server console instead.

GOOGLE_CLIENT_ID — create an OAuth 2.0 Client ID (type "Web application") in Google Cloud Console → APIs & Services → Credentials, and add your frontend URL (http://localhost:5173) under "Authorized JavaScript origins". No client secret or redirect URI is needed. Leave it empty to hide the Google button.

APP_URL — the frontend URL; used for CORS and for the link in verification emails.

🌐 Running the API Server
Bash
npm start        # or: npm run dev (restarts on file changes)
Endpoints (all JSON unless noted):

GET  /health
POST /api/analyze-preset   { form_name }
POST /api/analyze-pdf      multipart/form-data, field "file" (PDF)
POST /api/process-answer   { field, user_input, form_fields, context }
POST /api/validate         { form_fields, filled_answers }
POST /api/documents        { form_fields, filled_answers }
POST /api/score            { form_fields, filled_answers, validation_result }
POST /api/generate-pdf     { form_fields, filled_answers, document_checklist, form_name } → application/pdf

Auth (session is an httpOnly cookie; send requests with credentials):

GET  /api/auth/me                    → { user } (null when signed out)
GET  /api/auth/config                → { google_client_id }
POST /api/auth/signup                { name, email, password } → sends verification email
POST /api/auth/verify-email          { token } → verifies + signs in
POST /api/auth/resend-verification   { email }
POST /api/auth/login                 { email, password } → 403 code EMAIL_NOT_VERIFIED until verified
POST /api/auth/google                { credential } (Google ID token)
POST /api/auth/logout

💻 Running the Interactive Demo
This repository includes a fully functional, interactive terminal interface to test the 6-engine pipeline.

Bash
npm run demo
CLI Commands:
fill: Initiates the form-filling pipeline. You will be prompted to provide a PDF path, a DOCX path, or paste raw text. The AI will then conduct a dynamic interview to fill the form.

General Q&A: Type any question regarding government processes, visas, or documents, and the AI will act as a bureaucratic expert.

quit: Exits the application.

📂 Output
Upon completing an interview, the system uses pdfkit to generate a professional PDF (default: filled_form.pdf) containing:

All mapped applicant information.

A structured Document Checklist (Mandatory vs. Optional).

Submission Tips and Estimated Processing Times.

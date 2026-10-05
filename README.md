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

---

## ⚙️ Getting Started

```bash
npm run setup                          # install root, backend and frontend dependencies
cp backend/.env.example backend/.env   # then fill it in (see below)
npm run dev                            # backend on :8000 + frontend on :5173
```

Open http://localhost:5173. The Vite dev server proxies `/api` to the backend, so both run as one app.

In `backend/.env`:
- **AI** — `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`: any provider (OpenAI, Anthropic, Groq, Gemini, OpenRouter, Together, Mistral, DeepSeek, xAI, Ollama, or any OpenAI-compatible server via `custom` + `AI_BASE_URL`) and any model it serves. Without them the app runs on built-in offline fallbacks.
- **Database** — `DATABASE_URL` (PostgreSQL; tables are created on startup) and `JWT_SECRET`.
- **Email verification** — `SMTP_*` (optional in development: links are printed to the console).
- **Google sign-in** — `GOOGLE_CLIENT_ID` (optional).

Production: `npm run build` then `npm start` — the backend serves the built frontend on one port.

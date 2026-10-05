🏛️ CiviGuide AI: Frontend Application
The user interface for intelligent government form adaptation.

This repository contains the frontend client for CiviGuide AI, a system designed to automate the adaptation of rigid government forms into natural, accessible conversations. Built with React, it features a dynamic chat interface, live form previews, and a robust offline-fallback mode.

✨ Key Features
Conversational Interface (FormSession.jsx): A responsive chat UI where an AI (or local fallback engine) guides users through complex form fields one simple question at a time.

Dual Input Modes (Application.jsx): Users can either select standard pre-loaded forms (Passport, Income, Birth Certificate) or upload their own unmapped PDFs for the AI to parse.

Live Form Preview: A side-by-side view that populates a structured view of the form in real-time as the user chats, displaying validation warnings instantly.

Smart Document Checklist: Dynamically generates a checklist of required attachments based on form type and user answers, allowing direct uploads via the UI.

Confidence Scoring & Review: Provides a final pre-submission review with a calculated "Submission Confidence Score" to prevent government rejection.

Resilient Offline Mode: If the backend AI server goes down, the frontend automatically switches to a fully functional local mode with hardcoded schemas, local RegEx validation, and in-browser PDF generation using jsPDF.

🏗️ Project Architecture & Routing
Instead of relying on heavy routing libraries, the application uses lightweight, state-based routing via App.jsx, allowing for fast, seamless transitions between three main views:

CiviGuideAI.jsx (Home): The landing page explaining the problem, the solution, and the core tenets of the project (Security, Accessibility).

Application.jsx (Selection/Upload): The gateway where users define their intent by clicking a preset form card or dropping a PDF into the drag-and-drop zone.

FormSession.jsx (The Core Engine): The operational hub that manages the chat state, communicates with the API (or local logic), handles field validation, manages document uploads, and triggers final PDF generation.

⚙️ The API & Fallback Layer
The frontend expects the Express backend (backend/server.js) running at http://localhost:8000. Override this with a VITE_API_BASE entry in frontend/.env.
Upon loading a session, FormSession.jsx immediately pings /health.

🟢 Online Mode: The app routes inputs to backend engines (/api/analyze-pdf, /api/process-answer, /api/validate, /api/generate-pdf).

🟠 Offline Mode: The app intercepts requests and uses local JS functions (localProcessAnswer, localValidate, localScore, localGeneratePDF) and static definitions (FALLBACK_FIELDS, FALLBACK_DOCS) to ensure uninterrupted user experience.

🔐 Accounts
Users can create an account with email + password (activated through a verification link sent by email) or continue with Google. The "Sign in" button in the nav opens the auth dialog (src/auth/AuthModal.jsx); the session lives in an httpOnly cookie set by the backend, and src/auth/AuthProvider.jsx exposes it through useAuth(). The emailed link opens /verify-email (src/pages/VerifyEmail.jsx). The Google button appears automatically when the backend has GOOGLE_CLIENT_ID set.

🚀 Getting Started
Prerequisites
Node.js (v16+ recommended)

npm or yarn

Installation
Clone the repository:

Bash
git clone https://github.com/yourusername/civiguide-frontend.git
cd civiguide-frontend
Install dependencies:

Bash
npm install
(Note: The app dynamically loads jspdf via CDN when offline PDF generation is required, keeping the initial bundle light.)

Start the development server:

Bash
npm run dev
Connect the Backend (Optional but recommended):
For the full AI experience, start the Node backend (cd backend && npm start) so it runs on localhost:8000. If it isn't, look for the "Offline Mode" badge in the UI.

🎨 Styling
The application relies on custom CSS (src/styles.css, imported in main.jsx) using CSS variables for theming. It utilizes utility classes for flexbox layouts, glassmorphism panels (.glass-panel), and modern shadow elevations (.shadow-card). All icons are implemented as inline, zero-dependency SVG React components for maximum performance.
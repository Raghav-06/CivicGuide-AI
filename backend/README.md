🧠 CiviGuide AI: Backend Inference Engine
The intelligence layer for automated bureaucratic adaptation.

This repository contains the backend processing pipeline for CiviGuide AI. It is designed to ingest raw government forms (PDF/DOCX), understand their constraints, dynamically interview users in plain English, and output perfectly structured, highly confident PDF submissions.

🚀 The "Automated Adaptation" Pipeline
To safely handle government compliance, we don't rely on a single LLM prompt. Instead, we use a deterministic 6-Engine Architecture where each step has a specific, isolated responsibility, outputting strict JSON schema.

1️⃣ The Simplifier Engine (simplifier.py)
Ingestion: Reads raw text from PDFs or DOCX files.

Action: Extracts the underlying form schema and actively rewrites complex legal jargon into simple, conversational questions.

2️⃣ The Extractor Engine (extractor.py)
Action: Parses natural language user input ("I make about twenty thousand a month") and extracts the raw values, calculating a confidence score and flagging uncertainty for clarification.

3️⃣ The Mapper Engine (mapper.py)
Action: Maps the extracted entities to the rigid form schema.

Smart Derivation: Automatically calculates derived fields (e.g., extrapolating annual_income from a monthly_income answer).

4️⃣ The Validator Engine (validator.py)
Action: Runs cross-field logical checks to prevent immediate rejection (e.g., throwing an error if age < 18 but applying for a commercial license).

5️⃣ The Document Recommender (documents.py)
Action: Analyzes the filled schema to generate a personalized, dynamic checklist of required supporting documents, including "why" they are needed and processing time estimates.

6️⃣ The Scorer Engine (scorer.py)
Action: Calculates a final Submission Confidence Score (0-100) and a Risk Level (Low/Medium/High) based on completion rates, warnings, and AI qualitative assessment.

🛠️ Tech Stack & Integrations
Core Language: Python 3.10+

LLM Inference: Groq API (llama-3.3-70b-versatile) for ultra-low latency JSON generation.

Document Parsing: pypdf (PDFs) and python-docx (Word Documents).

PDF Generation: reportlab for compiling the final, structured, submission-ready PDF complete with dynamic tables and checklists.

⚙️ Installation & Setup
Clone the repository:

Bash
git clone https://github.com/yourusername/civiguide-backend.git
cd civiguide-backend
Create a virtual environment:

Bash
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
Install dependencies:

Bash
pip install requests python-dotenv pypdf python-docx reportlab
Configure Environment Variables:
Create a .env file in the root directory and add your Groq API key:

Code snippet
GROQ_API_KEY=your_groq_api_key_here
💻 Running the Interactive Demo
This repository includes a fully functional, interactive terminal interface to test the 6-engine pipeline.

Bash
python demo.py
CLI Commands:
fill: Initiates the form-filling pipeline. You will be prompted to provide a PDF path, a DOCX path, or paste raw text. The AI will then conduct a dynamic interview to fill the form.

General Q&A: Type any question regarding government processes, visas, or documents, and the AI will act as a bureaucratic expert.

quit: Exits the application.

📂 Output
Upon completing an interview, the system uses reportlab to generate a professional PDF (default: filled_form.pdf) containing:

All mapped applicant information.

A structured Document Checklist (Mandatory vs. Optional).

Submission Tips and Estimated Processing Times.
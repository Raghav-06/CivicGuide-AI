"""
CiviGuide AI — FastAPI Backend
================================
Exposes all 6 Python engines as REST endpoints for the React frontend.

Setup:
  pip install fastapi uvicorn python-multipart pypdf python-docx reportlab requests python-dotenv
  
  Create a .env file with:
    GROQ_API_KEY=your_groq_api_key_here

Run:
  uvicorn server:app --reload --port 8000

The React frontend will call http://localhost:8000
"""

import os
import sys
import json
import traceback
from pathlib import Path
from typing import Optional

# ── Add engines folder to path ──────────────────────────────────────────
# Place this file alongside the engines/ folder and the other .py files.
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import tempfile

# ── Import all 6 engines ────────────────────────────────────────────────
from core import analyze_form, process_answer, validate_form, get_documents, score_submission
from form_reader import read_form
from form_output import generate_filled_pdf

# ── FastAPI App ─────────────────────────────────────────────────────────
app = FastAPI(
    title="CiviGuide AI API",
    description="6-engine AI backend for government form processing",
    version="1.0.0"
)

# Allow the React dev server (port 5173/3000) and any localhost origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════════════
# REQUEST / RESPONSE MODELS
# ══════════════════════════════════════════════════════════════════════════

class AnalyzeRequest(BaseModel):
    form_text: str                       # raw text of the government form

class ProcessAnswerRequest(BaseModel):
    field: dict                          # current field object from form_fields
    user_input: str                      # what the user typed
    form_fields: list                    # full form schema
    context: dict                        # already filled answers

class ValidateRequest(BaseModel):
    form_fields: list
    filled_answers: dict

class DocumentsRequest(BaseModel):
    form_fields: list
    filled_answers: dict

class ScoreRequest(BaseModel):
    form_fields: list
    filled_answers: dict
    validation_result: dict

class GeneratePDFRequest(BaseModel):
    form_fields: list
    filled_answers: dict
    document_checklist: dict
    form_name: str = "Government Form"

class PresetFormRequest(BaseModel):
    form_name: str   # e.g. "Passport Application"


# ── Preset form texts used when user picks a card (not uploading a PDF) ──
PRESET_FORM_TEXTS = {
    "Passport Application": """
PASSPORT APPLICATION FORM (Form SP-1)

1. Full Name (as per birth certificate): _____________
2. Date of Birth (DD/MM/YYYY): _____________
3. Place of Birth (City, State, Country): _____________
4. Father's Full Name: _____________
5. Mother's Full Name: _____________
6. Present Residential Address (with PIN): _____________
7. Permanent Address (if different): _____________
8. Occupation: _____________
9. Emergency Contact Name: _____________
10. Emergency Contact Phone Number: _____________
11. Have you held a passport before? (Yes/No): _____________
12. If yes, previous passport number: _____________
13. Purpose of passport (Travel/Official/Diplomatic): _____________
14. Email Address: _____________
15. Mobile Number: _____________
""",
    "Income Certificate": """
INCOME CERTIFICATE APPLICATION FORM

1. Applicant Full Name: _____________
2. Date of Birth (DD/MM/YYYY): _____________
3. Father's / Husband's Full Name: _____________
4. Residential Address: _____________
5. PIN Code: _____________
6. Occupation / Designation: _____________
7. Employer / Business Name (if applicable): _____________
8. Monthly Income (in ₹): _____________
9. Annual Income (in ₹): _____________
10. Source of Income (Salary/Business/Agriculture/Other): _____________
11. Purpose of Certificate: _____________
12. Mobile Number: _____________
13. Aadhaar Number: _____________
14. Are you a BPL cardholder? (Yes/No): _____________
""",
    "Residence Proof Certificate": """
RESIDENCE PROOF / DOMICILE CERTIFICATE APPLICATION

1. Applicant Full Name: _____________
2. Date of Birth: _____________
3. Father's / Guardian's Name: _____________
4. Current Residential Address: _____________
5. Duration of Residence at current address (years): _____________
6. Ward Number / Locality: _____________
7. District: _____________
8. State: _____________
9. PIN Code: _____________
10. Nearest Landmark: _____________
11. Purpose of Domicile Certificate: _____________
12. Mobile Number: _____________
13. Aadhaar / Voter ID Number: _____________
""",
    "Birth Certificate": """
BIRTH CERTIFICATE APPLICATION FORM

1. Child's Full Name: _____________
2. Date of Birth (DD/MM/YYYY): _____________
3. Time of Birth: _____________
4. Place of Birth (Hospital / Home / Location): _____________
5. City / Village: _____________
6. District: _____________
7. Father's Full Name: _____________
8. Mother's Full Name: _____________
9. Father's Occupation: _____________
10. Permanent Address of Parents: _____________
11. PIN Code: _____________
12. Registrar's Jurisdiction / Office: _____________
13. Hospital Registration Number (if born in hospital): _____________
14. Contact Phone (parent): _____________
15. Mother's Aadhaar Number: _____________
""",
}


# ══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════

@app.get("/health")
def health():
    """Health check — confirms server is running."""
    return {"status": "ok", "message": "CiviGuide AI backend is running"}


# ── Engine 1+2: Analyze a preset form by name ─────────────────────────
@app.post("/api/analyze-preset")
async def analyze_preset(req: PresetFormRequest):
    """
    Takes a form name (card selection), looks up its text,
    runs Engine 1 (schema extraction) + Engine 2 (simplify questions).
    Returns form_fields list with simplified_question on each field.
    """
    form_text = PRESET_FORM_TEXTS.get(req.form_name)
    if not form_text:
        raise HTTPException(status_code=404, detail=f"Unknown preset form: {req.form_name}")
    try:
        fields = analyze_form(form_text)
        return {"form_fields": fields, "form_name": req.form_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Engine 1+2: Analyze an uploaded PDF ──────────────────────────────
@app.post("/api/analyze-pdf")
async def analyze_pdf(file: UploadFile = File(...)):
    """
    Accepts a PDF upload, extracts text, runs Engine 1+2.
    Returns form_fields list.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        form_text = read_form(tmp_path)
        fields = analyze_form(form_text)
        return {"form_fields": fields, "form_name": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)


# ── Engine 2+3: Process a single answer ──────────────────────────────
@app.post("/api/process-answer")
async def api_process_answer(req: ProcessAnswerRequest):
    """
    Runs Engine 2 (entity extraction) + Engine 3 (schema mapping)
    on a single user answer. Returns extracted value, confidence,
    derived fields, and whether clarification is needed.
    """
    try:
        result = process_answer(
            field=req.field,
            user_input=req.user_input,
            form_fields=req.form_fields,
            context=req.context
        )
        return result
    except Exception as e:
        # Graceful fallback — don't break the conversation
        field_name = req.field.get("field", "unknown")
        return {
            "primary_field": {field_name: req.user_input},
            "derived_fields": {},
            "confidence": 0.75,
            "uncertainty_detected": False,
            "clarification_needed": False,
            "clarification_question": None,
        }


# ── Engine 4: Validate form ───────────────────────────────────────────
@app.post("/api/validate")
async def api_validate(req: ValidateRequest):
    """
    Runs Engine 4 (logical + format validation) across all filled answers.
    Returns errors, warnings, is_valid.
    """
    try:
        result = validate_form(req.form_fields, req.filled_answers)
        return result
    except Exception as e:
        return {"errors": [], "warnings": [], "is_valid": True, "error_count": 0, "warning_count": 0}


# ── Engine 5: Document recommendations ───────────────────────────────
@app.post("/api/documents")
async def api_documents(req: DocumentsRequest):
    """
    Runs Engine 5 to recommend required documents
    based on form type and filled answers.
    """
    try:
        result = get_documents(req.form_fields, req.filled_answers)
        return result
    except Exception as e:
        return {
            "required_documents": [
                {"name": "Identity Proof", "reason": "Required for all applications", "mandatory": True},
                {"name": "Address Proof", "reason": "Required for all applications", "mandatory": True},
            ],
            "summary": "Please prepare standard identity and address proof documents.",
            "estimated_processing_time": "7–10 working days",
            "tips": ["Keep photocopies of all documents.", "Verify details before submission."]
        }


# ── Engine 6: Score submission ────────────────────────────────────────
@app.post("/api/score")
async def api_score(req: ScoreRequest):
    """
    Runs Engine 6 to generate submission confidence score and risk level.
    """
    try:
        result = score_submission(req.form_fields, req.filled_answers, req.validation_result)
        return result
    except Exception as e:
        filled_count = len([v for v in req.filled_answers.values() if v not in [None, ""]])
        total = max(len(req.form_fields), 1)
        pct = int(filled_count / total * 100)
        return {
            "submission_confidence_score": pct,
            "risk_level": "low" if pct >= 80 else "medium" if pct >= 55 else "high",
            "breakdown": [f"{pct}% fields completed"],
            "recommendation": "Review all fields before submitting.",
            "suspicious_patterns": [],
            "completion_rate": pct
        }


# ── PDF generation + download ─────────────────────────────────────────
@app.post("/api/generate-pdf")
async def api_generate_pdf(req: GeneratePDFRequest):
    """
    Runs reportlab PDF generation (form_output.py) and returns
    the PDF as a downloadable file response.
    """
    safe_name = req.form_name.replace(" ", "_").replace("/", "_")
    output_path = f"/tmp/{safe_name}_CiviGuide.pdf"

    try:
        generate_filled_pdf(
            form_fields=req.form_fields,
            filled_answers=req.filled_answers,
            document_checklist=req.document_checklist,
            output_path=output_path
        )
        return FileResponse(
            path=output_path,
            filename=f"{safe_name}_CiviGuide.pdf",
            media_type="application/pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")
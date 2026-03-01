import { useState, useEffect, useRef, useCallback } from "react";
/* ══════════════════════════════════════════════════════════════════════
   API LAYER
   All calls go to the FastAPI backend (server.py).
   If the server is offline, falls back to local static mode.
   ══════════════════════════════════════════════════════════════════════ */
const API_BASE = "http://localhost:8000";

async function apiFetch(endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${endpoint} returned ${res.status}`);
  return res.json();
}

/* Check if backend is up */
async function checkBackend() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

/* ── Engine 1+2: Analyze preset form by name ── */
async function apiAnalyzePreset(formName) {
  return apiFetch("/api/analyze-preset", { form_name: formName });
}

/* ── Engine 1+2: Analyze uploaded PDF ── */
async function apiAnalyzePDF(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/analyze-pdf`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(`PDF analysis failed: ${res.status}`);
  return res.json();
}

/* ── Engine 2+3: Process a single answer ── */
async function apiProcessAnswer(field, userInput, formFields, context) {
  return apiFetch("/api/process-answer", {
    field, user_input: userInput, form_fields: formFields, context
  });
}

/* ── Engine 4: Validate all answers ── */
async function apiValidate(formFields, filledAnswers) {
  return apiFetch("/api/validate", { form_fields: formFields, filled_answers: filledAnswers });
}

/* ── Engine 5: Get document recommendations ── */
async function apiDocuments(formFields, filledAnswers) {
  return apiFetch("/api/documents", { form_fields: formFields, filled_answers: filledAnswers });
}

/* ── Engine 6: Score submission ── */
async function apiScore(formFields, filledAnswers, validationResult) {
  return apiFetch("/api/score", {
    form_fields: formFields, filled_answers: filledAnswers, validation_result: validationResult
  });
}

/* ── PDF download via backend (reportlab) ── */
async function apiDownloadPDF(formFields, filledAnswers, documentChecklist, formName) {
  const res = await fetch(`${API_BASE}/api/generate-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      form_fields: formFields,
      filled_answers: filledAnswers,
      document_checklist: documentChecklist,
      form_name: formName,
    }),
  });
  if (!res.ok) throw new Error(`PDF generation failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${formName.replace(/\s+/g, "_")}_CiviGuide.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════════════════════════════════
   OFFLINE FALLBACK — full static definitions + local AI-like logic
   Used when backend is not running. Provides complete conversation,
   inline validation, smart scoring and document recommendations —
   all without any network calls.
   ══════════════════════════════════════════════════════════════════════ */

/* ── Field definitions (per form) ── */
const FALLBACK_FIELDS = {
  "Passport Application": [
    { field: "full_name",          label: "Full Name",               type: "text",   required: true,  simplified_question: "What is your full legal name as it appears on your birth certificate?" },
    { field: "date_of_birth",      label: "Date of Birth",           type: "date",   required: true,  simplified_question: "What is your date of birth? Please use DD/MM/YYYY format." },
    { field: "place_of_birth",     label: "Place of Birth",          type: "text",   required: true,  simplified_question: "Where were you born? (City, State, Country)" },
    { field: "fathers_name",       label: "Father's Full Name",     type: "text",   required: true,  simplified_question: "What is your father's full legal name?" },
    { field: "mothers_name",       label: "Mother's Full Name",     type: "text",   required: false, simplified_question: "What is your mother's full legal name?" },
    { field: "address",            label: "Residential Address",     type: "text",   required: true,  simplified_question: "What is your current residential address? Include street, city, district, state and PIN code." },
    { field: "occupation",         label: "Occupation",              type: "text",   required: true,  simplified_question: "What is your current occupation or profession?" },
    { field: "mobile",             label: "Mobile Number",           type: "phone",  required: true,  simplified_question: "What is your 10-digit mobile number?" },
    { field: "email",              label: "Email Address",           type: "email",  required: false, simplified_question: "What is your email address? (Optional)" },
    { field: "previous_passport",  label: "Previous Passport",       type: "boolean",required: false, simplified_question: "Have you held a passport before? (Yes or No)" },
  ],
  "Income Certificate": [
    { field: "full_name",          label: "Full Name",               type: "text",   required: true,  simplified_question: "What is your full legal name?" },
    { field: "date_of_birth",      label: "Date of Birth",           type: "date",   required: true,  simplified_question: "What is your date of birth? (DD/MM/YYYY)" },
    { field: "fathers_name",       label: "Father's / Husband's Name", type: "text", required: true, simplified_question: "What is your father's or husband's full name?" },
    { field: "address",            label: "Residential Address",     type: "text",   required: true,  simplified_question: "What is your full residential address including PIN code?" },
    { field: "occupation",         label: "Occupation / Designation",type: "text",   required: true,  simplified_question: "What is your occupation or job title?" },
    { field: "monthly_income",     label: "Monthly Income (₹)",      type: "number", required: true,  simplified_question: "What is your monthly income in rupees? (e.g. 25000)" },
    { field: "annual_income",      label: "Annual Income (₹)",       type: "number", required: true,  simplified_question: "What is your total annual income in rupees? (Monthly × 12 if salaried)" },
    { field: "income_source",      label: "Source of Income",        type: "text",   required: true,  simplified_question: "What is your main source of income? (e.g. Salary, Business, Agriculture)" },
    { field: "purpose",            label: "Purpose of Certificate",  type: "text",   required: true,  simplified_question: "Why do you need this income certificate? (e.g. Bank Loan, Scholarship, Government Scheme)" },
    { field: "aadhaar",            label: "Aadhaar Number",          type: "text",   required: false, simplified_question: "What is your 12-digit Aadhaar number? (Optional)" },
  ],
  "Residence Proof Certificate": [
    { field: "full_name",          label: "Full Name",               type: "text",   required: true,  simplified_question: "What is your full legal name?" },
    { field: "date_of_birth",      label: "Date of Birth",           type: "date",   required: true,  simplified_question: "What is your date of birth? (DD/MM/YYYY)" },
    { field: "fathers_name",       label: "Father's / Guardian's Name", type: "text", required: true, simplified_question: "What is your father's or guardian's full name?" },
    { field: "current_address",    label: "Current Address",         type: "text",   required: true,  simplified_question: "What is your current full address? Include house number, street, city, district, state and PIN code." },
    { field: "duration_years",     label: "Duration of Residence",   type: "number", required: true,  simplified_question: "How many complete years have you lived at this address?" },
    { field: "locality",           label: "Landmark / Locality",     type: "text",   required: false, simplified_question: "What is the nearest landmark or locality name near your home?" },
    { field: "ward_district",      label: "Ward / District",         type: "text",   required: true,  simplified_question: "What is your ward number or district name?" },
    { field: "purpose",            label: "Purpose",                 type: "text",   required: true,  simplified_question: "Why do you need this residence certificate? (e.g. School Admission, Job Application)" },
    { field: "mobile",             label: "Mobile Number",           type: "phone",  required: true,  simplified_question: "What is your mobile number?" },
  ],
  "Birth Certificate": [
    { field: "child_name",         label: "Child's Full Name",      type: "text",   required: true,  simplified_question: "What is the child's full name as it should appear on the certificate?" },
    { field: "date_of_birth",      label: "Date of Birth",           type: "date",   required: true,  simplified_question: "What is the child's date of birth? (DD/MM/YYYY)" },
    { field: "time_of_birth",      label: "Time of Birth",           type: "text",   required: false, simplified_question: "What was the time of birth? (e.g. 10:30 AM) — Optional" },
    { field: "place_of_birth",     label: "Place of Birth",          type: "text",   required: true,  simplified_question: "Where was the child born? (Name of hospital or home address)" },
    { field: "city_district",      label: "City / District",         type: "text",   required: true,  simplified_question: "Which city and district was the child born in?" },
    { field: "fathers_name",       label: "Father's Full Name",     type: "text",   required: true,  simplified_question: "What is the father's full legal name?" },
    { field: "mothers_name",       label: "Mother's Full Name",     type: "text",   required: true,  simplified_question: "What is the mother's full legal name?" },
    { field: "permanent_address",  label: "Permanent Address",       type: "text",   required: true,  simplified_question: "What is the parents' permanent address including PIN code?" },
    { field: "hospital_reg_no",    label: "Hospital Registration No.",type: "text",  required: false, simplified_question: "What is the hospital registration or delivery record number? (If born in hospital — Optional)" },
    { field: "registrar_office",   label: "Registrar's Jurisdiction",type: "text",  required: false, simplified_question: "Which registrar's office covers your area? (Optional — leave blank if unknown)" },
  ],
};

/* ── Required documents (per form) ── */
const FALLBACK_DOCS = {
  "Passport Application":        [
    { name: "Aadhaar Card / Voter ID", reason: "Primary identity proof", mandatory: true },
    { name: "Address Proof (Utility Bill / Bank Statement)", reason: "Verifies residential address", mandatory: true },
    { name: "Birth Certificate", reason: "Verifies date and place of birth", mandatory: true },
    { name: "Passport-size Photographs (2)", reason: "Required on application form", mandatory: true },
    { name: "PAN Card", reason: "Secondary identity proof", mandatory: false },
  ],
  "Income Certificate":          [
    { name: "Aadhaar Card", reason: "Identity verification", mandatory: true },
    { name: "Address Proof", reason: "Verifies residential address", mandatory: true },
    { name: "Latest Salary Slip / Income Proof", reason: "Primary income document", mandatory: true },
    { name: "Ration Card", reason: "Household and family verification", mandatory: false },
    { name: "Bank Statement (last 3 months)", reason: "Secondary income verification", mandatory: false },
  ],
  "Residence Proof Certificate": [
    { name: "Aadhaar Card / Voter ID", reason: "Identity proof", mandatory: true },
    { name: "Utility Bill (Electricity / Water — last 3 months)", reason: "Proves current address", mandatory: true },
    { name: "Rental Agreement or Property Deed", reason: "Legal proof of residence", mandatory: true },
    { name: "Passport-size Photograph (1)", reason: "Required on application", mandatory: true },
  ],
  "Birth Certificate":           [
    { name: "Hospital Birth Record / Discharge Summary", reason: "Primary proof of birth", mandatory: true },
    { name: "Father's Identity Proof (Aadhaar / PAN)", reason: "Parent verification", mandatory: true },
    { name: "Mother's Identity Proof (Aadhaar)", reason: "Parent verification", mandatory: true },
    { name: "Parents' Marriage Certificate", reason: "Family record", mandatory: true },
    { name: "Address Proof of Parents", reason: "Registration jurisdiction", mandatory: true },
  ],
};

/* ── Tips per form ── */
const FALLBACK_TIPS = {
  "Passport Application":        ["Keep self-attested photocopies of all documents.", "Original documents must be presented at verification.", "Processing time is typically 4–6 weeks for standard and 1–3 weeks for Tatkal."],
  "Income Certificate":          ["If self-employed, attach your last ITR filing.", "The certificate is usually valid for 6 months from issuance.", "Keep multiple copies — banks and colleges may each need one."],
  "Residence Proof Certificate": ["Utility bills must be in your name or a family member's name.", "A notarised affidavit may be required if you recently moved.", "Processing time is typically 7–10 working days."],
  "Birth Certificate":           ["Register within 21 days of birth to avoid late fees.", "If registering late, a magistrate affidavit may be required.", "Keep 4–5 certified copies — needed for school admission, passport, etc."],
};

/* ── Local validation rules (offline Engine 4 equivalent) ── */
function localValidate(formFields, fieldValues) {
  const errors   = [];
  const warnings = [];

  formFields.forEach((field) => {
    const val = fieldValues[field.field];
    const empty = val === undefined || val === null || String(val).trim() === "";

    if (field.required && empty) {
      errors.push({ field: field.field, reason: `"${field.label}" is required.`, severity: "error" });
      return;
    }
    if (empty) return;

    const v = String(val).trim();

    // Date format
    if (field.type === "date" && !/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
      warnings.push({ field: field.field, reason: `"${field.label}" should be in DD/MM/YYYY format.`, severity: "warning" });
    }

    // Phone format
    if (field.type === "phone" && !/^[6-9]\d{9}$/.test(v.replace(/\s/g, ""))) {
      warnings.push({ field: field.field, reason: `"${field.label}" should be a valid 10-digit Indian mobile number.`, severity: "warning" });
    }

    // Email format
    if (field.type === "email" && !/^[^@]+@[^@]+\.[^@]+$/.test(v)) {
      warnings.push({ field: field.field, reason: `"${field.label}" doesn't look like a valid email.`, severity: "warning" });
    }

    // Aadhaar
    if (field.field === "aadhaar" && v.replace(/\s/g, "").length !== 12) {
      warnings.push({ field: field.field, reason: "Aadhaar number should be 12 digits.", severity: "warning" });
    }

    // Number
    if (field.type === "number" && isNaN(Number(v.replace(/,/g, "")))) {
      errors.push({ field: field.field, reason: `"${field.label}" must be a number.`, severity: "error" });
    }
  });

  // Cross-field: monthly × 12 vs annual income for Income Certificate
  if (fieldValues.monthly_income && fieldValues.annual_income) {
    const monthly = Number(String(fieldValues.monthly_income).replace(/,/g, ""));
    const annual  = Number(String(fieldValues.annual_income).replace(/,/g, ""));
    if (!isNaN(monthly) && !isNaN(annual) && Math.abs(annual - monthly * 12) > monthly * 2) {
      warnings.push({ field: "annual_income", reason: "Annual income seems inconsistent with monthly income × 12.", severity: "warning" });
    }
  }

  return {
    errors, warnings,
    is_valid: errors.length === 0,
    error_count: errors.length,
    warning_count: warnings.length,
  };
}

/* ── Local scoring (offline Engine 6 equivalent) ── */
function localScore(formFields, fieldValues, validation) {
  let score = 100;
  const breakdown = [];

  const total    = formFields.length;
  const filled   = formFields.filter(f => {
    const v = fieldValues[f.field];
    return v !== undefined && v !== null && String(v).trim() !== "";
  }).length;
  const pct = Math.round(filled / total * 100);

  if (validation.error_count > 0) {
    const d = validation.error_count * 15;
    score -= d;
    breakdown.push(`−${d} pts: ${validation.error_count} validation error(s)`);
  }
  if (validation.warning_count > 0) {
    const d = validation.warning_count * 5;
    score -= d;
    breakdown.push(`−${d} pts: ${validation.warning_count} warning(s)`);
  }
  if (pct < 100) {
    const d = Math.round((100 - pct) * 0.3);
    score -= d;
    breakdown.push(`−${d} pts: ${100 - pct}% of fields still empty`);
  }

  score = Math.max(0, Math.min(100, score));
  const risk = score >= 80 ? "low" : score >= 55 ? "medium" : "high";

  const recs = {
    low:    "Your form looks complete and consistent. Ready to submit!",
    medium: "A few fields need review before submission.",
    high:   "Please fix validation errors before proceeding.",
  };

  return {
    submission_confidence_score: score,
    risk_level: risk,
    breakdown,
    recommendation: recs[risk],
    completion_rate: pct,
  };
}

/* ── Local next-question generator (offline Engine 2 equivalent) ── */
function localProcessAnswer(field, userInput, fieldValues) {
  const val   = userInput.trim();
  const key   = field.field;
  const primary   = { [key]: val };
  const derived   = {};

  // Derive annual from monthly income
  if (key === "monthly_income") {
    const n = Number(val.replace(/[^0-9.]/g, ""));
    if (!isNaN(n) && n > 0 && !fieldValues.annual_income) {
      derived.annual_income = String(n * 12);
    }
  }
  // Normalise Yes/No
  if (field.type === "boolean") {
    const lower = val.toLowerCase();
    primary[key] = lower.startsWith("y") ? "Yes" : lower.startsWith("n") ? "No" : val;
  }

  return { primary_field: primary, derived_fields: derived };
}

function getFallbackFields(formName) {
  return FALLBACK_FIELDS[formName] ?? FALLBACK_FIELDS["Passport Application"];
}

function getFallbackDocDefs(formName) {
  return FALLBACK_DOCS[formName] ?? FALLBACK_DOCS["Passport Application"];
}

/* ── FIX #1: Added missing getFallbackDocNames function ── */
function getFallbackDocNames(formName) {
  return getFallbackDocDefs(formName).map(d => d.name);
}

function getFallbackTips(formName) {
  return FALLBACK_TIPS[formName] ?? [];
}

/* ══════════════════════════════════════════════════════════════════════
   OFFLINE jsPDF FALLBACK (when backend PDF endpoint unavailable)
   ══════════════════════════════════════════════════════════════════════ */
let jsPDFPromise = null;
function loadJsPDF() {
  if (jsPDFPromise) return jsPDFPromise;
  jsPDFPromise = new Promise((resolve, reject) => {
    if (window.jspdf?.jsPDF) { resolve(window.jspdf.jsPDF); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload  = () => resolve(window.jspdf.jsPDF);
    s.onerror = () => reject(new Error("Failed to load jsPDF"));
    document.head.appendChild(s);
  });
  return jsPDFPromise;
}

async function localGeneratePDF(formFields, fieldValues, docUploads, selectedForm) {
  const JsPDF = await loadJsPDF();
  const doc   = new JsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("CiviGuide AI — Official Form", margin, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(selectedForm, margin, 21);
  const now = new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" });
  doc.text(`Generated: ${now}`, pageW - margin, 21, { align: "right" });
  y = 38;

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Form Fields", margin, y); y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageW - margin, y); y += 8;

  formFields.forEach((field) => {
    const value = fieldValues[field.field] ?? "— not provided —";
    if (y > 270) { doc.addPage(); y = margin; }
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(100, 100, 100);
    doc.text((field.label || field.field).toUpperCase(), margin, y); y += 5;
    doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(String(value), pageW - margin * 2);
    doc.text(lines, margin, y); y += lines.length * 6 + 4;
    doc.setDrawColor(240, 240, 240);
    doc.line(margin, y, pageW - margin, y); y += 4;
  });

  y += 6;
  if (y > 260) { doc.addPage(); y = margin; }
  doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 30, 30);
  doc.text("Uploaded Documents", margin, y); y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageW - margin, y); y += 8;

  Object.entries(docUploads).forEach(([name, info]) => {
    if (y > 270) { doc.addPage(); y = margin; }
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(100, 100, 100);
    doc.text(name.toUpperCase(), margin, y); y += 5;
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.setTextColor(22, 163, 74);
    doc.text(`✓  ${info.name}  (${info.size})`, margin, y); y += 9;
  });

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8); doc.setTextColor(160, 160, 160);
    doc.text(`CiviGuide AI · ${selectedForm} · Page ${p} of ${totalPages}`, pageW / 2, 292, { align: "center" });
  }

  const safeTitle = selectedForm.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  doc.save(`${safeTitle}_CiviGuide.pdf`);
}

/* ══════════════════════════════════════════════════════════════════════
   ICONS
   ══════════════════════════════════════════════════════════════════════ */
const Shield          = ({ size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>;
const BotIcon         = ({ size=14 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>;
const SendIcon        = ({ size=16 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>;
const FileTextIcon    = ({ size=16 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>;
const ChevronUpIcon   = ({ size=16 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>;
const CircleAlert     = ({ size=14 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>;
const CheckCircleIcon = ({ size=14 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>;
const TriangleAlert   = ({ size=14 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>;
const ClockIcon       = ({ size=18 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const UploadIcon      = ({ size=14 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>;
const DownloadIcon    = ({ size=16 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>;
const MenuIcon        = ({ size=24 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>;
const XIcon           = ({ size=14 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;
const WifiOffIcon     = ({ size=14 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" x2="22" y1="2" y2="22"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"/><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/><path d="M5 13a10 10 0 0 1 5.24-2.76"/><circle cx="12" cy="20" r="1"/></svg>;
const SparkleIcon     = ({ size=14 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>;

/* Render inline bold **text** */
function Bold({ text }) {
  return text.split(/\*\*(.*?)\*\*/g).map((p, i) =>
    i % 2 === 1 ? <strong key={i}>{p}</strong> : p
  );
}

const flatBtn = { background: "none", border: "none", cursor: "pointer", padding: 0 };

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════ */
export default function FormSession({
  selectedForm = "Passport Application",
  uploadedFile  = null,   // { name, file } — real File object from Application.jsx
  onGoHome,
  onGoApplication,
}) {
  /* ── UI state ── */
  const [mobileOpen,        setMobileOpen]        = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  /* ── Backend state ── */
  const [backendOnline,     setBackendOnline]     = useState(null);  // null=checking
  const [loadingFields,     setLoadingFields]     = useState(true);
  const [formFields,        setFormFields]        = useState([]);    // schema from Engine 1+2
  const [fieldValues,       setFieldValues]       = useState({});    // { field_key: value }

  /* ── Chat state ── */
  const [messages,          setMessages]          = useState([]);
  const [input,             setInput]             = useState("");
  const [isTyping,          setIsTyping]          = useState(false);
  const [currentFieldIdx,   setCurrentFieldIdx]   = useState(0);

  /* ── Bottom panel state (Engine 4–6) ── */
  const [docUploads,        setDocUploads]        = useState({});
  const [docRecommendations,setDocRecommendations]= useState(null); // from Engine 5
  const [validation,        setValidation]        = useState(null); // from Engine 4
  const [scoreData,         setScoreData]         = useState(null); // from Engine 6
  const [pipelineRunning,   setPipelineRunning]   = useState(false);
  const [pdfGenerating,     setPdfGenerating]     = useState(false);
  const [pdfError,          setPdfError]          = useState("");

  const chatRef      = useRef(null);
  const docInputRefs = useRef({});

  /* ── Derived ── */
  const filledCount  = Object.keys(fieldValues).length;
  const totalFields  = formFields.length;
  const progress     = totalFields > 0 ? Math.round((filledCount / totalFields) * 100) : 0;
  const confidence   = scoreData?.submission_confidence_score ?? progress;
  const allDone      = totalFields > 0 && filledCount >= totalFields;
  const confColor    = confidence >= 80 ? "var(--success)" : confidence >= 55 ? "var(--warning)" : "hsl(0,84%,60%)";

  /* ── Doc names to show — use Engine 5 recommendations if available, else fallback ── */
  // FIX #1: getFallbackDocNames is now defined above; this line no longer throws ReferenceError
  const docNames = docRecommendations?.required_documents?.map(d => d.name)
    ?? getFallbackDocNames(selectedForm);

  /* ── Auto-scroll chat ── */
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, isTyping]);

  /* ══════════════════════════════════════════════════════════════════
     INITIALISE: check backend, load form fields
     ══════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoadingFields(true);
      setFormFields([]);
      setFieldValues({});
      setCurrentFieldIdx(0);
      setDocUploads({});
      setValidation(null);
      setScoreData(null);
      setDocRecommendations(null);
      setPdfError("");

      const online = await checkBackend();
      if (cancelled) return;
      setBackendOnline(online);

      let fields = [];
      let formNameLabel = selectedForm;

      if (online) {
        try {
          setMessages([{ role: "system", text: `📄 Loading form fields from AI…` }]);

          let result;
          if (uploadedFile?.file) {
            // User uploaded a real PDF — analyze it
            result = await apiAnalyzePDF(uploadedFile.file);
            formNameLabel = uploadedFile.name ?? selectedForm;
          } else {
            // Preset card selected
            result = await apiAnalyzePreset(selectedForm);
          }

          if (cancelled) return;
          fields = result.form_fields ?? [];
        } catch (err) {
          console.warn("AI field load failed, falling back:", err);
          fields = getFallbackFields(selectedForm);
        }
      } else {
        fields = getFallbackFields(selectedForm);
      }

      if (cancelled) return;
      setFormFields(fields);
      setLoadingFields(false);

      const intro = online
        ? `I've loaded your **${formNameLabel}** form using AI analysis.\n\nI found **${fields.length} fields**. I'll ask you each one in simple language — just answer naturally and I'll handle the formatting.`
        : `I've loaded **${formNameLabel}**.\n\n⚡ Running in offline mode — start the backend server for AI-powered extraction.\n\nI'll guide you through **${fields.length} fields**.`;

      setMessages([
        { role: "system", text: `📄 Form session: ${formNameLabel}${online ? " · AI Active" : " · Offline Mode"}` },
        { role: "ai", text: intro },
        { role: "ai", text: fields[0]?.simplified_question ?? fields[0]?.label ?? "Let's begin. What is your full name?" },
      ]);
    }

    init();
    return () => { cancelled = true; };
  }, [selectedForm, uploadedFile]);

  /* ══════════════════════════════════════════════════════════════════
     SEND MESSAGE — Engine 2+3 (online) or localProcessAnswer (offline)
     ══════════════════════════════════════════════════════════════════ */
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping || allDone || formFields.length === 0) return;

    const fieldIdx   = currentFieldIdx;
    const field      = formFields[fieldIdx];
    if (!field) return;

    setMessages(prev => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setIsTyping(true);

    let primaryField  = { [field.field]: trimmed };
    let derivedFields = {};
    let clarification = null;
    let uncertainty   = false;

    if (backendOnline) {
      try {
        const result = await apiProcessAnswer(field, trimmed, formFields, fieldValues);
        primaryField  = result.primary_field  ?? primaryField;
        derivedFields = result.derived_fields ?? {};
        clarification = result.clarification_needed ? result.clarification_question : null;
        uncertainty   = result.uncertainty_detected ?? false;
      } catch (err) {
        // FIX #2: Fall back to local processing if API call fails while online
        console.warn("process-answer API failed, using local fallback:", err);
        const local = localProcessAnswer(field, trimmed, fieldValues);
        primaryField  = local.primary_field;
        derivedFields = local.derived_fields;
      }
    } else {
      // FIX #2: Always use localProcessAnswer in offline mode (was previously unused)
      const local = localProcessAnswer(field, trimmed, fieldValues);
      primaryField  = local.primary_field;
      derivedFields = local.derived_fields;
    }

    // If AI wants clarification
    if (clarification) {
      setIsTyping(false);
      setMessages(prev => [...prev, { role: "ai", text: `🤔 ${clarification}` }]);
      return;
    }

    // Commit values
    const newFieldValues = { ...fieldValues, ...primaryField, ...derivedFields };
    setFieldValues(newFieldValues);

    const savedValue = Object.values(primaryField)[0] ?? trimmed;
    const nextIdx    = fieldIdx + 1;
    setCurrentFieldIdx(nextIdx);
    setIsTyping(false);

    // Derived field notice
    const derivedNotices = Object.entries(derivedFields)
      .filter(([k]) => k !== field.field)
      .map(([k, v]) => `↳ Also derived **${k}** = ${v}`)
      .join("\n");

    if (nextIdx < formFields.length) {
      const nextField = formFields[nextIdx];
      const nextQ     = nextField.simplified_question ?? nextField.label ?? `What is your ${nextField.field.replace(/_/g, " ")}?`;
      const notice    = uncertainty ? `⚠ Noted with uncertainty: "${savedValue}"\n\n` : `✅ Got it — **${field.label || field.field}**: "${savedValue}"\n\n`;
      setMessages(prev => [...prev, {
        role: "ai",
        text: notice + (derivedNotices ? derivedNotices + "\n\n" : "") + nextQ,
      }]);
    } else {
      // ALL FIELDS DONE — run pipeline (online: full AI pipeline; offline: local engines)
      setMessages(prev => [...prev, {
        role: "ai",
        text: `✅ All **${totalFields} fields** are complete!\n\n${backendOnline ? "Running AI validation and document analysis…" : "Running local validation…"}`,
      }]);
      runPostFillPipeline(newFieldValues);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isTyping, allDone, formFields, currentFieldIdx, fieldValues, backendOnline]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  /* ══════════════════════════════════════════════════════════════════
     POST-FILL PIPELINE — Engines 4, 5, 6 (online) or local equivalents (offline)
     FIX #3: Offline mode now runs localValidate + localScore instead of returning early
     ══════════════════════════════════════════════════════════════════ */
  const runPostFillPipeline = useCallback(async (answers) => {
    setPipelineRunning(true);

    try {
      let val, docs, score;

      if (backendOnline) {
        // ── Online path: call all three API engines ──
        val   = await apiValidate(formFields, answers);
        docs  = await apiDocuments(formFields, answers);
        score = await apiScore(formFields, answers, val);

        setValidation(val);
        setDocRecommendations(docs);
        setScoreData(score);
      } else {
        // ── Offline path: use local equivalents ──
        val   = localValidate(formFields, answers);
        score = localScore(formFields, answers, val);
        // No local equivalent for Engine 5 — fallback doc names come from FALLBACK_DOCS
        docs  = {
          required_documents: getFallbackDocDefs(selectedForm),
          summary: null,
          estimated_processing_time: null,
          tips: getFallbackTips(selectedForm),
        };

        setValidation(val);
        setScoreData(score);
        // Don't overwrite docRecommendations in offline mode — let docNames fallback handle it
      }

      // ── Post results to chat ──
      const errCount  = val?.error_count  ?? 0;
      const warnCount = val?.warning_count ?? 0;
      const scoreVal  = score?.submission_confidence_score ?? 0;
      const risk      = score?.risk_level ?? "medium";
      const riskEmoji = risk === "low" ? "🟢" : risk === "medium" ? "🟡" : "🔴";

      let summary = `**${backendOnline ? "AI" : "Local"} Analysis Complete**\n\n`;
      summary += `${riskEmoji} Confidence Score: **${scoreVal}/100** (${risk.toUpperCase()} risk)\n`;
      if (errCount > 0)  summary += `❌ ${errCount} validation error(s) found\n`;
      if (warnCount > 0) summary += `⚠ ${warnCount} warning(s)\n`;
      if (errCount === 0 && warnCount === 0) summary += `✅ No validation issues\n`;
      if (score?.recommendation) summary += `\n💡 ${score.recommendation}`;

      setMessages(prev => [...prev, { role: "ai", text: summary }]);

      // If there are errors, list them
      if (errCount > 0 && val.errors?.length) {
        const errList = val.errors.map(e => `• **${e.field}**: ${e.reason}`).join("\n");
        setMessages(prev => [...prev, { role: "ai", text: `Validation issues:\n\n${errList}` }]);
      }

      if (backendOnline && docs?.summary) {
        setMessages(prev => [...prev, { role: "ai", text: `📁 **Documents needed:** ${docs.summary}\n\nSee the documents panel below to upload each one.` }]);
      }

    } catch (err) {
      console.warn("Post-fill pipeline error:", err);
      // If online pipeline fails, attempt local fallback
      if (backendOnline) {
        try {
          const val   = localValidate(formFields, answers);
          const score = localScore(formFields, answers, val);
          setValidation(val);
          setScoreData(score);
          setMessages(prev => [...prev, { role: "ai", text: "⚠ AI analysis failed — showing local validation results instead." }]);
        } catch (localErr) {
          console.warn("Local fallback also failed:", localErr);
        }
      }
    } finally {
      setPipelineRunning(false);
    }
  }, [backendOnline, formFields, selectedForm]);

  /* ══════════════════════════════════════════════════════════════════
     DOCUMENT UPLOAD (per row)
     ══════════════════════════════════════════════════════════════════ */
  const triggerDocUpload = (docName) => {
    if (!docInputRefs.current[docName]) {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "application/pdf,image/*";
      inp.style.display = "none";
      inp.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const sizeKB = Math.round(file.size / 1024);
          const sizeText = sizeKB > 1024 ? `${(sizeKB/1024).toFixed(1)} MB` : `${sizeKB} KB`;
          setDocUploads(prev => ({ ...prev, [docName]: { name: file.name, size: sizeText } }));
        }
        inp.value = "";
      });
      document.body.appendChild(inp);
      docInputRefs.current[docName] = inp;
    }
    docInputRefs.current[docName].click();
  };

  const removeDoc = (docName) => {
    setDocUploads(prev => { const n = {...prev}; delete n[docName]; return n; });
  };

  /* ══════════════════════════════════════════════════════════════════
     PDF DOWNLOAD — backend first, jsPDF fallback
     ══════════════════════════════════════════════════════════════════ */
  const handleDownloadPDF = async () => {
    setPdfError("");
    setPdfGenerating(true);

    // Build a checklist that works whether Engine 5 ran or not
    const checklist = docRecommendations ?? {
      required_documents: getFallbackDocDefs(selectedForm),
      summary: "Please bring the listed documents when submitting.",
      estimated_processing_time: "7–10 working days",
      tips: getFallbackTips(selectedForm),
    };

    // Try backend PDF (reportlab — professional quality)
    if (backendOnline) {
      try {
        await apiDownloadPDF(formFields, fieldValues, checklist, selectedForm);
        setPdfGenerating(false);
        return;
      } catch (err) {
        console.warn("Backend PDF failed, falling back to jsPDF:", err);
      }
    }

    // Fallback: jsPDF in-browser
    try {
      await localGeneratePDF(formFields, fieldValues, docUploads, selectedForm);
    } catch (err) {
      setPdfError("Could not generate PDF. Please check your connection and try again.");
    } finally {
      setPdfGenerating(false);
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════ */
  const validationErrors   = validation?.errors   ?? [];
  const validationWarnings = validation?.warnings  ?? [];
  const riskLevel          = scoreData?.risk_level ?? null;

  return (
    <div className="app-root">

      {/* ── NAV ── */}
      <nav className="glass-panel nav-sticky">
        <div className="nav-inner">
          <button style={flatBtn} className="nav-brand" onClick={() => onGoHome?.()}>
            <div className="gradient-primary-bg nav-brand-icon">
              <Shield size={20} style={{ color: "hsl(210,40%,98%)" }} />
            </div>
            <span className="nav-brand-text">CiviGuide AI</span>
          </button>
          <div className="nav-links hide-mobile">
            <button style={flatBtn} className="nav-link" onClick={() => onGoHome?.()}>Home</button>
            <button style={flatBtn} className="nav-link">How It Works</button>
            <button style={flatBtn} className="nav-link" onClick={() => onGoApplication?.()}>Start Application</button>
            <button className="btn-primary" style={{ height: 36, padding: "0 12px" }} onClick={() => onGoApplication?.()}>Get Started</button>
          </div>
          <button className="nav-mobile-btn hide-desktop" onClick={() => setMobileOpen(o => !o)}>
            <MenuIcon size={24} />
          </button>
        </div>
        {mobileOpen && (
          <div className="nav-mobile-menu hide-desktop">
            <button style={flatBtn} className="nav-link" onClick={() => onGoHome?.()}>Home</button>
            <button style={flatBtn} className="nav-link">How It Works</button>
            <button style={flatBtn} className="nav-link" onClick={() => onGoApplication?.()}>Start Application</button>
            <button className="btn-primary" style={{ height: 40, padding: "0 16px" }} onClick={() => onGoApplication?.()}>Get Started</button>
          </div>
        )}
      </nav>
      {backendOnline === true && (
        <div className="backend-banner backend-banner-online">
          <SparkleIcon size={14} />
          <span>AI backend connected — all 6 engines active</span>
        </div>
      )}

      <main className="main-content">

        {/* ── TOP: Chat + Preview ── */}
        <div className="top-grid">

          {/* ── LEFT: Chat ── */}
          <div className="panel-card">
            <div className="progress-header">
              <div className="progress-label-row">
                <span className="progress-label">
                  {loadingFields ? "Loading form…" : `Form Progress — ${selectedForm}`}
                </span>
                <span className="progress-pct">{progress}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${loadingFields ? 0 : progress}%` }} />
              </div>
            </div>

            <div className="chat-scroll" ref={chatRef}>
              {messages.map((msg, i) => {
                if (msg.role === "system") return (
                  <div key={i} className="chat-system-badge"><span>{msg.text}</span></div>
                );
                if (msg.role === "ai") return (
                  <div key={i} className="chat-row">
                    <div className="chat-avatar gradient-primary-bg">
                      <BotIcon size={14} style={{ color: "white" }} />
                    </div>
                    <div className="chat-bubble-ai">
                      {msg.text.split("\n").map((line, li) => (
                        <div key={li}><Bold text={line} /></div>
                      ))}
                    </div>
                  </div>
                );
                return (
                  <div key={i} className="chat-row chat-row-user">
                    <div className="chat-bubble-user">{msg.text}</div>
                  </div>
                );
              })}

              {(isTyping || pipelineRunning) && (
                <div className="chat-row">
                  <div className="chat-avatar gradient-primary-bg">
                    <BotIcon size={14} style={{ color: "white" }} />
                  </div>
                  <div className="chat-bubble-ai">
                    <div className="typing-dots">
                      <span /><span /><span />
                    </div>
                    {pipelineRunning && <span style={{ fontSize: "0.7rem", color: "var(--muted-fg)", marginLeft: 6 }}>Running {backendOnline ? "AI" : "local"} analysis…</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="chat-input-bar">
              <div className="chat-input-row">
                <input
                  className="chat-input"
                  placeholder={
                    loadingFields    ? "Loading form fields…" :
                    allDone          ? "All fields done — check review below." :
                    isTyping         ? "AI is processing…" :
                                       "Type your answer naturally…"
                  }
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isTyping || allDone || loadingFields}
                />
                <button
                  className="chat-send-btn"
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping || allDone || loadingFields}
                >
                  <SendIcon size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Mobile toggle ── */}
          <div className="mobile-toggle">
            <button className="btn-ghost" style={{ width: "100%" }} onClick={() => setShowMobilePreview(o => !o)}>
              <FileTextIcon size={16} />
              {showMobilePreview ? "Hide" : "Show"} Form Preview
              <ChevronUpIcon size={16} style={{ marginLeft: "auto", transform: showMobilePreview ? "rotate(180deg)" : "none" }} />
            </button>
          </div>

          {/* ── RIGHT: Live Preview ── */}
          <div className="panel-card preview-desktop" style={showMobilePreview ? { display: "flex" } : {}}>
            <div className="preview-header-bar">
              <div className="preview-header-left">
                <FileTextIcon size={16} style={{ color: "var(--primary)" }} />
                <span className="preview-header-title">Live Form Preview</span>
              </div>
              <div className="confidence-badge">
                <div className="confidence-dot" style={{ background: confColor }} />
                <span className="confidence-text">
                  {riskLevel ? `${riskLevel.toUpperCase()} risk · ` : ""}{confidence}%
                </span>
              </div>
            </div>
            <div className="preview-scroll">
              <div className="preview-form-badge">
                <p className="preview-form-name">{selectedForm}</p>
                <p className="preview-form-sub">
                  {backendOnline ? "AI-extracted fields" : "Static fields"} · {totalFields} total
                </p>
              </div>

              {loadingFields ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted-fg)", fontSize: "0.875rem" }}>
                  <div className="pdf-spinner" style={{ margin: "0 auto 8px", borderTopColor: "var(--primary)", border: "2px solid var(--border)", borderTopColor: "var(--primary)" }} />
                  Analysing form with AI…
                </div>
              ) : (
                formFields.map((field) => {
                  const val = fieldValues[field.field];
                  const hasError = validationErrors.some(e => e.field === field.field);
                  return (
                    <div key={field.field} className={`field-row${val ? " filled" : ""}${hasError ? " field-error" : ""}`}>
                      <div className="field-row-top">
                        <label className="field-label">{field.label || field.field}</label>
                        {val && !hasError && <CheckCircleIcon size={14} style={{ color: "var(--success)" }} />}
                        {hasError          && <TriangleAlert  size={14} style={{ color: "hsl(0,84%,60%)" }} />}
                        {!val && !hasError && <CircleAlert    size={14} style={{ color: "rgba(107,114,128,0.4)" }} />}
                      </div>
                      {val ? <p className="field-value">{val}</p> : <p className="field-empty">Awaiting response…</p>}
                      {hasError && (
                        <p className="field-error-msg">{validationErrors.find(e => e.field === field.field)?.reason}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── BOTTOM: Documents + Review ── */}
        <div className="bottom-grid">

          {/* ── Documents ── */}
          <div className="panel-card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <h3 className="section-title" style={{ marginBottom: 0 }}>Required Documents</h3>
              {docRecommendations?.estimated_processing_time && (
                <span style={{ fontSize: "0.75rem", color: "var(--muted-fg)" }}>
                  ⏱ {docRecommendations.estimated_processing_time}
                </span>
              )}
            </div>

            {docRecommendations?.summary && (
              <p style={{ fontSize: "0.8rem", color: "var(--muted-fg)", marginBottom: "1rem", lineHeight: 1.5 }}>
                {docRecommendations.summary}
              </p>
            )}

            <div className="doc-list">
              {docNames.map((docName) => {
                const uploaded    = docUploads[docName];
                // Get AI reason if available, else fallback to static definition
                const docInfo = docRecommendations?.required_documents?.find(d => d.name === docName)
                  ?? getFallbackDocDefs(selectedForm).find(d => d.name === docName);
                const mandatory  = docInfo?.mandatory ?? true;
                const reason     = docInfo?.reason;

                return (
                  <div key={docName} className={`doc-row${uploaded ? " doc-row-uploaded" : ""}`}>
                    <div className="doc-row-left">
                      {uploaded
                        ? <CheckCircleIcon size={18} style={{ color: "var(--success)", flexShrink: 0 }} />
                        : <ClockIcon size={18} style={{ color: "var(--warning)", flexShrink: 0 }} />
                      }
                      <div style={{ minWidth: 0 }}>
                        <p className="doc-name">
                          {docName}
                          {!mandatory && <span style={{ fontSize: "0.68rem", color: "var(--muted-fg)", marginLeft: 6, fontWeight: 400 }}>optional</span>}
                        </p>
                        {uploaded
                          ? <p className="doc-status doc-status-ok" title={uploaded.name}>{uploaded.name} · {uploaded.size}</p>
                          : reason
                            ? <p className="doc-status" style={{ fontStyle: "italic" }}>{reason}</p>
                            : <p className="doc-status">pending upload</p>
                        }
                      </div>
                    </div>
                    {!uploaded ? (
                      <button className="btn-ghost" onClick={() => triggerDocUpload(docName)}>
                        <UploadIcon size={14} /> Upload
                      </button>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn-ghost" style={{ fontSize: "0.75rem" }} onClick={() => triggerDocUpload(docName)}>Change</button>
                        <button className="btn-ghost" style={{ padding: "0 8px", color: "hsl(0,84%,60%)", borderColor: "hsl(0,84%,85%)" }} onClick={() => removeDoc(docName)}>
                          <XIcon size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Show tips from AI recommendations OR static fallback tips */}
            {(() => {
              const tips = docRecommendations?.tips?.length
                ? docRecommendations.tips
                : getFallbackTips(selectedForm);
              return tips.length > 0 ? (
                <div style={{ marginTop: "1rem", padding: "10px 12px", background: "var(--accent)", borderRadius: 8 }}>
                  <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--accent-fg)", marginBottom: 4 }}>💡 Tips</p>
                  {tips.map((tip, i) => (
                    <p key={i} style={{ fontSize: "0.75rem", color: "var(--accent-fg)", lineHeight: 1.5 }}>• {tip}</p>
                  ))}
                </div>
              ) : null;
            })()}
          </div>

          {/* ── Final Review + Score + Download ── */}
          <div className="panel-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="review-header">
              <h3 className="section-title" style={{ marginBottom: 0 }}>Final Review</h3>
              <div className="review-confidence">
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: confColor }} />
                <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)" }}>
                  {confidence}% {riskLevel ? `· ${riskLevel} risk` : ""}
                </span>
              </div>
            </div>

            {/* Score breakdown */}
            {scoreData?.breakdown?.length > 0 && (
              <div style={{ background: "var(--accent)", borderRadius: 8, padding: "10px 12px" }}>
                {scoreData.breakdown.map((line, i) => (
                  <p key={i} style={{ fontSize: "0.75rem", color: "var(--accent-fg)" }}>• {line}</p>
                ))}
              </div>
            )}

            {/* Field review list */}
            <div className="review-list">
              {formFields.map((field) => {
                const val      = fieldValues[field.field];
                const hasError = validationErrors.some(e => e.field === field.field);
                return (
                  <div key={field.field} className="review-row">
                    <span className="review-row-key">{field.label || field.field}</span>
                    {val ? (
                      <div className={hasError ? "review-row-val-missing" : "review-row-val-ok"}>
                        <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {String(val)}
                        </span>
                        {hasError ? <TriangleAlert size={14} /> : <CheckCircleIcon size={14} />}
                      </div>
                    ) : (
                      <div className="review-row-val-missing">
                        <span>Missing</span><TriangleAlert size={14} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Warnings */}
            {validationWarnings.length > 0 && (
              <div className="warning-box">
                {validationWarnings.map((w, i) => (
                  <p key={i} style={{ fontSize: "0.75rem" }}>⚠ [{w.field}] {w.reason}</p>
                ))}
              </div>
            )}

            {!allDone && (
              <div className="warning-box">
                <p>⚠ {totalFields - filledCount} field(s) still needed. Complete the chat above first.</p>
              </div>
            )}

            {pdfError && <p style={{ fontSize: "0.8rem", color: "hsl(0,84.2%,60.2%)" }}>{pdfError}</p>}

            <div className="review-actions">
              <button
                className="btn-primary"
                style={{ height: 40, padding: "0 1.25rem", opacity: (!allDone || pdfGenerating) ? 0.6 : 1 }}
                disabled={!allDone || pdfGenerating}
                onClick={handleDownloadPDF}
              >
                {pdfGenerating
                  ? <><span className="pdf-spinner" /> Generating…</>
                  : <><DownloadIcon size={16} /> Download PDF</>
                }
              </button>
            </div>

            {allDone && (
              <p style={{ fontSize: "0.75rem", color: "var(--muted-fg)", marginTop: -4 }}>
                📎 {filledCount} fields · {Object.keys(docUploads).length} doc(s) attached
                {backendOnline ? " · AI-validated" : " · locally validated"}
              </p>
            )}
          </div>

        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="footer-root">
        <div className="footer-inner">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="footer-brand-row">
                <div className="gradient-primary-bg footer-brand-icon">
                  <Shield size={16} style={{ color: "hsl(210,40%,98%)" }} />
                </div>
                <span className="footer-brand-name">CiviGuide AI</span>
              </div>
              <p className="footer-brand-desc">Transforming complex government forms into simple conversations.</p>
            </div>
            <div>
              <h4 className="footer-col-title">Product</h4>
              <button style={flatBtn} className="footer-link" onClick={() => onGoHome?.()}>Home</button>
              <button style={flatBtn} className="footer-link" onClick={() => onGoApplication?.()}>Start Application</button>
            </div>
            <div>
              <h4 className="footer-col-title">Legal</h4>
              <a href="#" className="footer-link">Privacy Policy</a>
              <a href="#" className="footer-link">Terms of Service</a>
            </div>
            <div>
              <h4 className="footer-col-title">Connect</h4>
              <a href="#" className="footer-link">Contact</a>
              <a href="#" className="footer-link">GitHub</a>
              <span className="footer-badge">🏆 Hackathon Project</span>
            </div>
          </div>
          <div className="footer-bottom">
            <p className="footer-copyright">© 2026 CiviGuide AI. Built for public accessibility.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
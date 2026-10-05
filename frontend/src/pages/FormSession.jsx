import { useState, useEffect, useRef } from "react";
import { API_BASE, ApiError, apiRequest, getBackendStatus } from "../api/client";
import { useAuth } from "../auth/authContext";
import NavAuth from "../components/NavAuth";
/* ══════════════════════════════════════════════════════════════════════
   API LAYER
   All calls go to the Express backend (backend/server.js).
   If the server is offline — or online without an AI provider — the
   engines run locally; only PDF generation still uses the server.
   ══════════════════════════════════════════════════════════════════════ */

function apiFetch(endpoint, body) {
  return apiRequest(endpoint, { method: "POST", body });
}

/* Is the backend up, and does it have AI? → { online, aiEnabled, aiRequiresLogin } */
function checkBackend() {
  return getBackendStatus();
}

/* ── Engine 1+2: Analyze preset form by name ── */
async function apiAnalyzePreset(formName) {
  return apiFetch("/api/analyze-preset", { form_name: formName });
}

/* ── Engine 1+2: Analyze uploaded PDF / DOCX ── */
async function apiAnalyzePDF(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/analyze-pdf`, { method: "POST", body: formData, credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.detail ?? `Form analysis failed (${res.status})`, res.status, data.code);
  return data;
}

/* ── Assistant: answer a question about the current field / form ── */
async function apiAsk(question, field, formName) {
  const { answer } = await apiFetch("/api/ask", { question, field, form_name: formName });
  return answer;
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

/* ── PDF download via backend (pdfkit) ── */
async function apiDownloadPDF(formFields, filledAnswers, documentChecklist, formName) {
  const res = await fetch(`${API_BASE}/api/generate-pdf`, {
    method: "POST",
    credentials: "include",
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

/* ── Local answer parsing (offline Engine 2+3 equivalent) ── */
const UNCERTAIN_RE = /\b(around|about|approx(?:imately|\.)?|maybe|roughly)\b/i;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const AMOUNT_UNITS = {
  k: 1e3, thousand: 1e3, thousands: 1e3,
  l: 1e5, lac: 1e5, lacs: 1e5, lakh: 1e5, lakhs: 1e5,
  cr: 1e7, crore: 1e7, crores: 1e7,
  million: 1e6,
};

/* "20k", "20,000", "₹ 25000", "around 20 thousand", "1.5 lakh", "2 lakhs", "1 crore" → number (or null). */
function parseAmount(text) {
  const s = String(text).toLowerCase()
    .replace(/(\d),(?=\d)/g, "$1")
    .replace(/₹|\brs\.?|\binr\b|\brupees?\b/g, " ");
  const m = s.match(/(\d+(?:\.\d+)?)\s*(k|thousands?|lakhs?|lacs?|l|crores?|cr|million)?\b/);
  if (!m) return null;
  const n = Number(m[1]) * (AMOUNT_UNITS[m[2]] ?? 1);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/* 15-8-1990, 15.08.1990, 1990-08-15, 15 Aug 1990, Aug 15 1990 → "DD/MM/YYYY" (or null). */
function parseDateDMY(text) {
  const s = String(text).trim();
  let d, mo, y, m;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)))                         [, y, mo, d] = m;
  else if ((m = s.match(/^(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{4})$/)))                [, d, mo, y] = m;
  else if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]{3,})\.?,?[\s-]+(\d{4})$/i))) {
    d = m[1]; mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1; y = m[3];
  } else if ((m = s.match(/^([a-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i))) {
    mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1; d = m[2]; y = m[3];
  } else return null;
  [d, mo, y] = [Number(d), Number(mo), Number(y)];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (!mo || date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${String(d).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${y}`;
}

/* Strip spaces/dashes and a leading +91 / 0. */
function normalisePhone(text) {
  let s = String(text).replace(/[\s\-().]/g, "");
  if (s.startsWith("+91")) s = s.slice(3);
  else if (/^0091\d{10}$/.test(s)) s = s.slice(4);
  else if (/^91\d{10}$/.test(s)) s = s.slice(2);
  else if (/^0\d{10}$/.test(s)) s = s.slice(1);
  return s;
}

/* Match a select answer to its canonical option: exact (any case) first, then a single option named in the text. */
function matchOption(options, text) {
  const lower = String(text).trim().toLowerCase();
  const exact = options.find(o => String(o).trim().toLowerCase() === lower);
  if (exact !== undefined) return exact;
  const named = options.filter(o => new RegExp(`\\b${String(o).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower));
  return named.length === 1 ? named[0] : null;
}

/* Returns the same shape as the backend's /api/process-answer. */
function localProcessAnswer(field, userInput, fieldValues, formFields = []) {
  const val     = userInput.trim();
  const key     = field.field;
  const label   = field.label || key;
  const primary = { [key]: val };
  const derived = {};
  const result  = {
    primary_field: primary, derived_fields: derived,
    uncertainty_detected: UNCERTAIN_RE.test(val),
    clarification_needed: false, clarification_question: null,
  };
  const clarify = (question) => ({ ...result, clarification_needed: true, clarification_question: question });
  const onForm  = (k) => formFields.some(f => f.field === k);

  if (field.type === "number") {
    let n = parseAmount(val);
    if (n === null) return clarify(`I couldn't find a number in that. What is your ${label}? Please enter it in digits, e.g. 25000.`);
    // Monthly income given as a yearly figure ("3 lakh per year"): store the monthly share.
    if (key === "monthly_income" && /\b(year|yearly|annual(ly)?|per annum|p\.?a\.?)\b/i.test(val)) {
      if (onForm("annual_income") && !isFilled(fieldValues.annual_income)) derived.annual_income = n;
      n = Math.round(n / 12);
    }
    primary[key] = n;
    if (key === "monthly_income" && onForm("annual_income") && !isFilled(fieldValues.annual_income) && derived.annual_income === undefined) {
      derived.annual_income = n * 12;
    }
  } else if (field.type === "date") {
    const date = parseDateDMY(val);
    if (!date) return clarify(`Please give the ${label} as DD/MM/YYYY, e.g. 15/08/1990.`);
    primary[key] = date;
  } else if (field.type === "phone") {
    primary[key] = normalisePhone(val);
  } else if (field.type === "boolean") {
    const lower = val.toLowerCase();
    primary[key] = /^(y|yes|haan|ha)\b/.test(lower) ? "Yes" : /^(n|no|nahi|nope)\b/.test(lower) ? "No" : val;
  } else if (field.type === "email") {
    primary[key] = val.toLowerCase();
  } else if (field.options?.length) {
    const option = matchOption(field.options, val);
    if (option === null) return clarify(`Please choose one of: ${field.options.join(", ")}.`);
    primary[key] = option;
  }

  return result;
}

function getFallbackFields(formName) {
  return FALLBACK_FIELDS[formName] ?? FALLBACK_FIELDS["Passport Application"];
}

/* Generic checklist for uploaded forms that have no preset documents. */
const GENERIC_DOCS = [
  { name: "Identity Proof (Aadhaar / Voter ID / PAN)", reason: "Required for all applications", mandatory: true },
  { name: "Address Proof", reason: "Required for all applications", mandatory: true },
  { name: "Passport-size Photograph", reason: "Usually required on the application", mandatory: false },
];

function getFallbackDocDefs(formName) {
  return FALLBACK_DOCS[formName] ?? GENERIC_DOCS;
}

/* ── FIX #1: Added missing getFallbackDocNames function ── */
function getFallbackDocNames(formName) {
  return getFallbackDocDefs(formName).map(d => d.name);
}

function getFallbackTips(formName) {
  return FALLBACK_TIPS[formName] ?? [];
}

/* ── Field-state helpers ── */
function isFilled(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function formatValue(value) {
  if (value === true)  return "Yes";
  if (value === false) return "No";
  return String(value);
}

/* First field at or after `from` that has no value yet (fields can be filled early by derivation). */
function nextUnfilledIndex(formFields, values, from) {
  for (let i = from; i < formFields.length; i++) {
    if (!isFilled(values[formFields[i].field])) return i;
  }
  return formFields.length;
}

function questionFor(field) {
  return field.simplified_question ?? field.label ?? `What is your ${field.field.replace(/_/g, " ")}?`;
}

/* Is this chat message a question for the assistant rather than an answer? */
function parseHelpRequest(text) {
  const lower = text.toLowerCase();
  if (lower === "help" || lower === "?") return { question: null };
  const m = text.match(/^help[\s:,-]+(.+)$/i);
  if (m) return { question: m[1].trim() };
  // A multi-word sentence ending in "?" is a question, not an answer.
  if (text.endsWith("?") && text.split(/\s+/).length >= 3) return { question: text };
  return null;
}

/* Offline explanation of a field (no AI available). */
function localFieldHelp(field) {
  const parts = [];
  if (field.description && field.description !== field.label) parts.push(`On the official form this reads: "${field.description}".`);
  const formats = {
    date:    "Use the DD/MM/YYYY format, e.g. 15/08/1990.",
    phone:   "Enter a 10-digit mobile number, e.g. 9876543210.",
    email:   "Enter an email address, e.g. name@example.com.",
    number:  "Enter a number only, e.g. 25000.",
    boolean: "Answer Yes or No.",
  };
  if (formats[field.type]) parts.push(formats[field.type]);
  if (field.options?.length) parts.push(`Valid options: ${field.options.join(", ")}.`);
  parts.push(field.required
    ? "This field is required for submission."
    : "This field is optional — type **skip** if it doesn't apply to you.");
  return parts.join("\n");
}

/* ══════════════════════════════════════════════════════════════════════
   OFFLINE jsPDF FALLBACK (last resort, when the backend PDF endpoint is unavailable)
   jsPDF's built-in fonts only cover Windows-1252, so ₹ and Indian scripts can't be
   drawn here — the backend PDF (with bundled Noto fonts) handles those.
   ══════════════════════════════════════════════════════════════════════ */
const WIN1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const pdfSafe = (v) => String(v ?? "").replace(/₹\s*/g, "Rs. ");   // ₹ is common enough to spell out
function hasUnsupportedChars(values) {
  return values.some(v => [...pdfSafe(v)].some(c => c.charCodeAt(0) > 0xFF && !WIN1252_EXTRA.includes(c)));
}
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
  doc.text(pdfSafe(selectedForm), margin, 21);
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
    doc.text(pdfSafe(field.label || field.field).toUpperCase(), margin, y); y += 5;
    doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(pdfSafe(value), pageW - margin * 2);
    doc.text(lines, margin, y); y += lines.length * 6 + 4;
    doc.setDrawColor(240, 240, 240);
    doc.line(margin, y, pageW - margin, y); y += 4;
  });

  y += 6;
  if (y > 260) { doc.addPage(); y = margin; }
  doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 30, 30);
  doc.text("Documents Marked Ready", margin, y); y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageW - margin, y); y += 8;

  Object.entries(docUploads).forEach(([name, info]) => {
    if (y > 270) { doc.addPage(); y = margin; }
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(100, 100, 100);
    doc.text(pdfSafe(name).toUpperCase(), margin, y); y += 5;
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.setTextColor(22, 163, 74);
    doc.text(info.name ? `Ready - file noted: ${info.name}` : "Ready", margin, y); y += 9;
  });

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8); doc.setTextColor(160, 160, 160);
    doc.text(`CiviGuide AI · ${pdfSafe(selectedForm)} · Page ${p} of ${totalPages}`, pageW / 2, 292, { align: "center" });
  }

  const safeTitle = selectedForm.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") || "Form";
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
  onGoHowItWorks,
}) {
  /* ── UI state ── */
  const [mobileOpen,        setMobileOpen]        = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  /* ── Backend state ── */
  const [backendOnline,     setBackendOnline]     = useState(null);  // null=checking; used for PDF generation
  const [aiActive,          setAiActive]          = useState(false); // backend has AI → Engines 1–6 run there
  const [aiNeedsLogin,      setAiNeedsLogin]      = useState(false); // AI exists but this server requires sign-in
  const { user } = useAuth();
  const userRef = useRef(user);   // read at session start; changing it mustn't restart the session
  useEffect(() => { userRef.current = user; }, [user]);
  const [loadingFields,     setLoadingFields]     = useState(true);
  const [formFields,        setFormFields]        = useState([]);    // schema from Engine 1+2
  const [fieldValues,       setFieldValues]       = useState({});    // { field_key: value }

  /* ── Chat state ── */
  const [messages,          setMessages]          = useState([]);
  const [input,             setInput]             = useState("");
  const [isTyping,          setIsTyping]          = useState(false);
  const [currentFieldIdx,   setCurrentFieldIdx]   = useState(0);
  const [interviewDone,     setInterviewDone]     = useState(false); // every field answered or skipped
  const [editingIdx,        setEditingIdx]        = useState(null);  // re-answering one field after the interview
  const [aiFields,          setAiFields]          = useState(false); // fields came from Engine 1+2 (not static fallback)

  /* ── Bottom panel state (Engine 4–6) ── */
  const [docUploads,        setDocUploads]        = useState({});
  const [docRecommendations,setDocRecommendations]= useState(null); // from Engine 5
  const [validation,        setValidation]        = useState(null); // from Engine 4
  const [scoreData,         setScoreData]         = useState(null); // from Engine 6
  const [pipelineRunning,   setPipelineRunning]   = useState(false);
  const [pdfGenerating,     setPdfGenerating]     = useState(false);
  const [pdfError,          setPdfError]          = useState("");

  const chatRef      = useRef(null);
  const docInputRef  = useRef(null);   // one hidden file input shared by every document row
  const pendingDoc   = useRef(null);   // which document row opened the file picker

  /* ── Derived ── */
  // Count only schema fields — derived values can add keys that aren't on the form.
  const filledCount  = formFields.filter(f => isFilled(fieldValues[f.field])).length;
  const totalFields  = formFields.length;
  const progress     = totalFields > 0 ? Math.round((filledCount / totalFields) * 100) : 0;
  const confidence   = scoreData?.submission_confidence_score ?? progress;
  const busy         = isTyping || pipelineRunning;
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
      setInterviewDone(false);
      setEditingIdx(null);
      setAiFields(false);
      setDocUploads({});
      setValidation(null);
      setScoreData(null);
      setDocRecommendations(null);
      setPdfError("");

      const status = await checkBackend();
      if (cancelled) return;
      const online = status.online;
      const needsLogin = status.aiEnabled && status.aiRequiresLogin && !userRef.current;
      const ai = status.aiEnabled && !needsLogin;
      setBackendOnline(online);
      setAiActive(ai);
      setAiNeedsLogin(needsLogin);

      const formNameLabel = uploadedFile?.name ?? selectedForm;
      let fields = [];
      let fromAI = false;
      let loadError = null;
      let analysisNotice = null;

      if (ai) {
        try {
          setMessages([{ role: "system", text: `📄 Analysing ${formNameLabel} with AI…` }]);
          const result = uploadedFile?.file
            ? await apiAnalyzePDF(uploadedFile.file)   // user's own PDF / DOCX
            : await apiAnalyzePreset(selectedForm);    // preset card
          if (cancelled) return;
          fields = result.form_fields ?? [];
          fromAI = fields.length > 0;
          analysisNotice = result.notice ?? null;
        } catch (err) {
          console.warn("AI field load failed:", err);
          loadError = err.message;
        }
      }

      // Preset forms have built-in fields to fall back on; an uploaded form has nothing to fall back to.
      if (!fromAI && !uploadedFile?.file) fields = getFallbackFields(selectedForm);

      if (cancelled) return;
      setFormFields(fields);
      setAiFields(fromAI);
      setLoadingFields(false);

      if (fields.length === 0) {
        setMessages([
          { role: "system", text: `📄 ${formNameLabel}` },
          {
            role: "ai",
            text: ai
              ? `I couldn't analyse **${formNameLabel}**.\n\n${loadError ?? "No fillable fields were found."}\n\nYou can try another file, or choose one of the ready-made forms from **Start Application**.`
              : online
                ? `Analysing your own form needs AI, which ${needsLogin ? "requires you to sign in on this server" : "isn't configured on this server"}.\n\nChoose one of the ready-made forms from **Start Application** — those work with built-in rules.`
                : `Analysing your own form needs the AI backend, which isn't reachable right now.\n\nStart the backend server and try again, or choose one of the ready-made forms from **Start Application** — those work offline.`,
          },
        ]);
        return;
      }

      const howTo = "Answer in your own words. Type **skip** to skip a question, or **help** if you're not sure what to enter.";
      const intro = fromAI
        ? `I've analysed your **${formNameLabel}** form with AI and found **${fields.length} fields**. I'll ask about each one in simple language.` +
          (analysisNotice ? `\n\n⚠ ${analysisNotice}` : "") + `\n\n${howTo}`
        : ai
          ? `AI analysis isn't available right now, so I've loaded the standard **${formNameLabel}** fields instead (${fields.length} fields).\n\n${howTo}`
          : online
            ? `I've loaded **${formNameLabel}** (${fields.length} fields).\n\nAI isn't ${needsLogin ? "available until you sign in" : "configured on this server"}, so I'll use built-in rules to read your answers — write amounts like **25000** or **20k** and dates as **DD/MM/YYYY**.\n\n${howTo}`
            : `I've loaded **${formNameLabel}** (${fields.length} fields).\n\n⚡ Running in offline mode — start the backend server for AI-powered extraction.\n\n${howTo}`;

      setMessages([
        { role: "system", text: `📄 Form session: ${formNameLabel}${ai ? " · AI Active" : online ? " · Built-in rules" : " · Offline Mode"}` },
        { role: "ai", text: intro },
        { role: "ai", text: questionFor(fields[0]) },
      ]);
    }

    init();
    return () => { cancelled = true; };
  }, [selectedForm, uploadedFile]);

  const addMessage = (role, text) => setMessages(prev => [...prev, { role, text }]);

  /* Move on after field `fromIdx` was answered or skipped: ask the next empty field, or finish. */
  const advance = (fromIdx, values, prefix) => {
    // After editing a single answer, go straight back to the review.
    const nextIdx = editingIdx !== null ? formFields.length : nextUnfilledIndex(formFields, values, fromIdx + 1);
    setEditingIdx(null);
    setCurrentFieldIdx(nextIdx);

    if (nextIdx < formFields.length) {
      addMessage("ai", (prefix ? prefix + "\n\n" : "") + questionFor(formFields[nextIdx]));
      return;
    }

    setInterviewDone(true);
    const answered = formFields.filter(f => isFilled(values[f.field])).length;
    addMessage("ai",
      (prefix ? prefix + "\n\n" : "") +
      `✅ Interview complete — **${answered} of ${formFields.length} fields** answered.\n\n` +
      (aiActive ? "Running AI validation and document analysis…" : "Running local validation…"));
    runPostFillPipeline(values);
  };

  /* ══════════════════════════════════════════════════════════════════
     SEND MESSAGE — Engine 2+3 (online) or localProcessAnswer (offline)
     Also handles the "skip" and "help" commands.
     ══════════════════════════════════════════════════════════════════ */
  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || busy || interviewDone || formFields.length === 0) return;

    const fieldIdx = currentFieldIdx;
    const field    = formFields[fieldIdx];
    if (!field) return;
    const label    = field.label || field.field;

    addMessage("user", trimmed);
    setInput("");

    /* ── skip ── */
    if (trimmed.toLowerCase() === "skip") {
      if (editingIdx !== null) {
        setEditingIdx(null);
        setCurrentFieldIdx(formFields.length);
        setInterviewDone(true);
        addMessage("ai", `Okay — kept your existing answer for **${label}**.`);
        return;
      }
      const note = field.required
        ? `⏭ Skipped **${label}**. It's required, so you'll need to fill it in before submitting — use **Edit** in the review panel.`
        : `⏭ Skipped **${label}**.`;
      advance(fieldIdx, fieldValues, note);
      return;
    }

    /* ── help / questions ── */
    const help = parseHelpRequest(trimmed);
    if (help) {
      setIsTyping(true);
      let answer;
      if (aiActive) {
        try {
          answer = await apiAsk(
            help.question ?? `What does the field "${label}" mean, and what should I enter?`,
            field, selectedForm);
        } catch (err) {
          console.warn("ask API failed, using local help:", err);
        }
      }
      setIsTyping(false);
      addMessage("ai", `${answer ?? localFieldHelp(field)}\n\n${questionFor(field)}`);
      return;
    }

    /* ── an answer ── */
    setIsTyping(true);

    let result = null;
    if (aiActive) {
      try {
        result = await apiProcessAnswer(field, trimmed, formFields, fieldValues);
      } catch (err) {
        console.warn("process-answer API failed, using local fallback:", err);
      }
    }
    result ??= localProcessAnswer(field, trimmed, fieldValues, formFields);

    let primaryField  = result.primary_field ?? { [field.field]: trimmed };
    let derivedFields = result.derived_fields ?? {};
    let clarification = result.clarification_needed ? (result.clarification_question || `Could you tell me your ${label} again?`) : null;
    let uncertainty   = result.uncertainty_detected ?? false;

    setIsTyping(false);

    // AI wants clarification — stay on this field
    if (clarification) {
      addMessage("ai", `🤔 ${clarification}`);
      return;
    }

    // Commit: the primary answer always wins; derived values only fill fields that are still empty.
    const newFieldValues = { ...fieldValues };
    for (const [k, v] of Object.entries(derivedFields)) {
      if (k !== field.field && !isFilled(newFieldValues[k])) newFieldValues[k] = v;
    }
    Object.assign(newFieldValues, primaryField);
    setFieldValues(newFieldValues);

    // Engines 4–6 results are stale once an answer changes.
    if (editingIdx !== null) {
      setValidation(null);
      setScoreData(null);
    }

    const savedValue = formatValue(Object.values(primaryField)[0] ?? trimmed);
    const derivedNotices = Object.entries(derivedFields)
      .filter(([k]) => k !== field.field && newFieldValues[k] === derivedFields[k] && !isFilled(fieldValues[k]))
      .map(([k, v]) => `↳ Also filled **${formFields.find(f => f.field === k)?.label ?? k}** = ${formatValue(v)}`)
      .join("\n");
    const notice = uncertainty
      ? `⚠ Noted with uncertainty — **${label}**: "${savedValue}". You can change it later in the review panel.`
      : `✅ Got it — **${label}**: "${savedValue}"`;

    advance(fieldIdx, newFieldValues, notice + (derivedNotices ? "\n" + derivedNotices : ""));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  /* Re-open one field from the review panel. */
  const startEdit = (idx) => {
    if (busy || !formFields[idx]) return;
    const field = formFields[idx];
    const current = fieldValues[field.field];
    setEditingIdx(idx);
    setCurrentFieldIdx(idx);
    setInterviewDone(false);
    addMessage("ai",
      `Let's update **${field.label || field.field}**` +
      (isFilled(current) ? ` (currently "${formatValue(current)}")` : "") +
      `. Type **skip** to keep it as it is.\n\n${questionFor(field)}`);
  };

  /* ══════════════════════════════════════════════════════════════════
     POST-FILL PIPELINE — Engines 4, 5, 6 (online) or local equivalents (offline)
     ══════════════════════════════════════════════════════════════════ */
  const runPostFillPipeline = async (answers) => {
    setPipelineRunning(true);

    try {
      let val, docs, score;

      if (aiActive) {
        // ── Online path: Engines 4 + 5 are independent; Engine 6 needs Engine 4's result ──
        [val, docs] = await Promise.all([
          apiValidate(formFields, answers),
          apiDocuments(formFields, answers),
        ]);
        score = await apiScore(formFields, answers, val);

        setValidation(val);
        setDocRecommendations(docs);
        setScoreData(score);
      } else {
        // ── Offline path: use local equivalents ──
        val   = localValidate(formFields, answers);
        score = localScore(formFields, answers, val);
        // No local Engine 5 — the documents panel falls back to FALLBACK_DOCS
        setValidation(val);
        setScoreData(score);
      }

      // ── Post results to chat ──
      const errCount  = val?.error_count  ?? 0;
      const warnCount = val?.warning_count ?? 0;
      const scoreVal  = score?.submission_confidence_score ?? 0;
      const risk      = score?.risk_level ?? "medium";
      const riskEmoji = risk === "low" ? "🟢" : risk === "medium" ? "🟡" : "🔴";

      let summary = `**${aiActive ? "AI" : "Local"} Analysis Complete**\n\n`;
      summary += `${riskEmoji} Confidence Score: **${scoreVal}/100** (${risk.toUpperCase()} risk)\n`;
      if (errCount > 0)  summary += `❌ ${errCount} validation error(s) found\n`;
      if (warnCount > 0) summary += `⚠ ${warnCount} warning(s)\n`;
      if (errCount === 0 && warnCount === 0) summary += `✅ No validation issues\n`;
      if (score?.recommendation) summary += `\n💡 ${score.recommendation}`;
      addMessage("ai", summary);

      if (errCount > 0 && val.errors?.length) {
        const labelOf = (key) => formFields.find(f => f.field === key)?.label ?? key;
        const errList = val.errors.map(e => `• **${labelOf(e.field)}**: ${e.reason}`).join("\n");
        addMessage("ai", `Validation issues:\n\n${errList}\n\nUse **Edit** next to a field in the review panel to fix it.`);
      }

      if (aiActive && docs?.summary) {
        addMessage("ai", `📁 **Documents needed:** ${docs.summary}\n\nSee the documents panel below to attach each one.`);
      }

    } catch (err) {
      console.warn("Post-fill pipeline error:", err);
      // If the online pipeline fails, fall back to local validation
      const val   = localValidate(formFields, answers);
      const score = localScore(formFields, answers, val);
      setValidation(val);
      setScoreData(score);
      addMessage("ai", `⚠ AI analysis failed — showing local validation results instead. Confidence: **${score.submission_confidence_score}/100**.`);
    } finally {
      setPipelineRunning(false);
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     DOCUMENT UPLOAD (per row)
     ══════════════════════════════════════════════════════════════════ */
  const triggerDocUpload = (docName) => {
    pendingDoc.current = docName;
    docInputRef.current?.click();
  };

  const onDocFileChosen = (e) => {
    const file    = e.target.files?.[0];
    const docName = pendingDoc.current;
    if (file && docName) {
      const sizeKB = Math.round(file.size / 1024);
      const sizeText = sizeKB > 1024 ? `${(sizeKB/1024).toFixed(1)} MB` : `${sizeKB} KB`;
      setDocUploads(prev => ({ ...prev, [docName]: { name: file.name, size: sizeText } }));
    }
    e.target.value = "";   // allow choosing the same file again
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

    // Build a checklist that works whether Engine 5 ran or not, marking which documents are attached
    const base = docRecommendations ?? {
      required_documents: getFallbackDocDefs(selectedForm),
      summary: "Please bring the listed documents when submitting.",
      estimated_processing_time: "7–10 working days",
      tips: getFallbackTips(selectedForm),
    };
    const checklist = {
      ...base,
      required_documents: (base.required_documents ?? []).map(d => ({ ...d, attached_file: docUploads[d.name]?.name })),
    };

    // Try backend PDF (pdfkit — professional quality)
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
      const texts = [selectedForm, ...formFields.map(f => f.label), ...Object.values(fieldValues), ...Object.keys(docUploads)];
      if (hasUnsupportedChars(texts)) {
        setPdfError("Some of your answers use characters (such as ₹ or Hindi text) that the offline PDF can't display, so they may look wrong. Start the backend server for a PDF that renders them correctly.");
      }
      await localGeneratePDF(formFields, fieldValues, docUploads, selectedForm);
    } catch {
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
            <button style={flatBtn} className="nav-link" onClick={() => onGoHowItWorks?.()}>How It Works</button>
            <button style={flatBtn} className="nav-link" onClick={() => onGoApplication?.()}>Start Application</button>
            <button className="btn-primary" style={{ height: 36, padding: "0 12px" }} onClick={() => onGoApplication?.()}>Get Started</button>
            <NavAuth />
          </div>
          <button className="nav-mobile-btn hide-desktop" onClick={() => setMobileOpen(o => !o)}>
            <MenuIcon size={24} />
          </button>
        </div>
        {mobileOpen && (
          <div className="nav-mobile-menu hide-desktop">
            <button style={flatBtn} className="nav-link" onClick={() => onGoHome?.()}>Home</button>
            <button style={flatBtn} className="nav-link" onClick={() => onGoHowItWorks?.()}>How It Works</button>
            <button style={flatBtn} className="nav-link" onClick={() => onGoApplication?.()}>Start Application</button>
            <button className="btn-primary" style={{ height: 40, padding: "0 16px" }} onClick={() => onGoApplication?.()}>Get Started</button>
            <NavAuth />
          </div>
        )}
      </nav>
      {backendOnline === true && aiActive && (
        <div className="backend-banner backend-banner-online">
          <SparkleIcon size={14} />
          <span>AI backend connected — all 6 engines active</span>
        </div>
      )}
      {backendOnline === true && !aiActive && !loadingFields && (
        <div className="backend-banner backend-banner-neutral">
          <CircleAlert size={14} />
          <span>{aiNeedsLogin
            ? "Sign in to use AI — running with built-in rules"
            : "AI not configured — running with built-in rules"}</span>
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
                  {loadingFields ? "Loading form…" : `Form Progress — ${uploadedFile?.name ?? selectedForm}`}
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
                    {pipelineRunning && <span style={{ fontSize: "0.7rem", color: "var(--muted-fg)", marginLeft: 6 }}>Running {aiActive ? "AI" : "local"} analysis…</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="chat-input-bar">
              <div className="chat-input-row">
                <input
                  className="chat-input"
                  placeholder={
                    loadingFields           ? "Loading form fields…" :
                    formFields.length === 0 ? "No form loaded" :
                    interviewDone           ? "All done — check the review below, or use Edit to change an answer." :
                    busy                    ? "AI is processing…" :
                                              "Type your answer — or 'skip' / 'help'"
                  }
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={busy || interviewDone || loadingFields || formFields.length === 0}
                />
                <button
                  className="chat-send-btn"
                  onClick={handleSend}
                  disabled={!input.trim() || busy || interviewDone || loadingFields || formFields.length === 0}
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
                <p className="preview-form-name">{uploadedFile?.name ?? selectedForm}</p>
                <p className="preview-form-sub">
                  {aiFields ? "AI-extracted fields" : "Standard fields"} · {totalFields} total
                </p>
              </div>

              {loadingFields ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted-fg)", fontSize: "0.875rem" }}>
                  <div className="pdf-spinner" style={{ margin: "0 auto 8px", border: "2px solid var(--border)", borderTopColor: "var(--primary)" }} />
                  Analysing form with AI…
                </div>
              ) : (
                formFields.map((field, idx) => {
                  const val = fieldValues[field.field];
                  const filled = isFilled(val);
                  const hasError = validationErrors.some(e => e.field === field.field);
                  const isCurrent = !interviewDone && idx === currentFieldIdx;
                  return (
                    <div key={field.field} className={`field-row${filled ? " filled" : ""}${hasError ? " field-error" : ""}${isCurrent ? " field-current" : ""}`}>
                      <div className="field-row-top">
                        <label className="field-label">{field.label || field.field}</label>
                        {filled && !hasError  && <CheckCircleIcon size={14} style={{ color: "var(--success)" }} />}
                        {hasError             && <TriangleAlert  size={14} style={{ color: "hsl(0,84%,60%)" }} />}
                        {!filled && !hasError && <CircleAlert    size={14} style={{ color: "rgba(107,114,128,0.4)" }} />}
                      </div>
                      {filled
                        ? <p className="field-value">{formatValue(val)}</p>
                        : <p className="field-empty">{isCurrent ? "Answering now…" : interviewDone ? "Not provided" : "Awaiting response…"}</p>}
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

            <input ref={docInputRef} type="file" accept="application/pdf,image/*" hidden onChange={onDocFileChosen} />
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
              {formFields.map((field, idx) => {
                const val      = fieldValues[field.field];
                const hasError = validationErrors.some(e => e.field === field.field);
                const missing  = !isFilled(val);
                return (
                  <div key={field.field} className="review-row">
                    <span className="review-row-key">
                      {field.label || field.field}
                      {field.required && <span className="review-required" title="Required">*</span>}
                    </span>
                    <div className="review-row-right">
                      {!missing ? (
                        <div className={hasError ? "review-row-val-missing" : "review-row-val-ok"}>
                          <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {formatValue(val)}
                          </span>
                          {hasError ? <TriangleAlert size={14} /> : <CheckCircleIcon size={14} />}
                        </div>
                      ) : (
                        <div className={field.required || hasError ? "review-row-val-missing" : "review-row-val-optional"}>
                          <span>{field.required ? "Missing" : "Skipped"}</span>
                          {(field.required || hasError) && <TriangleAlert size={14} />}
                        </div>
                      )}
                      {interviewDone && (
                        <button className="review-edit-btn" disabled={busy} onClick={() => startEdit(idx)}
                          aria-label={`Edit ${field.label || field.field}`}>
                          Edit
                        </button>
                      )}
                    </div>
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

            {!interviewDone && totalFields > 0 && (
              <div className="warning-box">
                <p>⚠ {editingIdx !== null
                  ? "Finish updating the field in the chat above."
                  : `${totalFields - filledCount} field(s) still to go. Complete the chat above to unlock the review.`}</p>
              </div>
            )}

            {pdfError && <p style={{ fontSize: "0.8rem", color: "hsl(0,84.2%,60.2%)" }}>{pdfError}</p>}

            <div className="review-actions">
              <button
                className="btn-primary"
                style={{ height: 40, padding: "0 1.25rem", opacity: (!interviewDone || busy || pdfGenerating) ? 0.6 : 1 }}
                disabled={!interviewDone || busy || pdfGenerating}
                onClick={handleDownloadPDF}
              >
                {pdfGenerating
                  ? <><span className="pdf-spinner" /> Generating…</>
                  : <><DownloadIcon size={16} /> Download PDF</>
                }
              </button>
            </div>

            {interviewDone && (
              <p style={{ fontSize: "0.75rem", color: "var(--muted-fg)", marginTop: -4 }}>
                📎 {filledCount}/{totalFields} fields · {Object.keys(docUploads).length} doc(s) attached
                {validation ? (aiActive ? " · AI-validated" : " · locally validated") : " · validating…"}
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
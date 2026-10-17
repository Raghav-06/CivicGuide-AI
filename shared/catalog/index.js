/**
 * CiviGuide service catalogue: a hand-written knowledge base of Indian government
 * applications, shared by the backend (API, prep sheet PDF) and the frontend (instant search,
 * guide pages), the same way ../answerRules.js is.
 *
 * Each category lives in its own module; this file joins them and adds search helpers.
 *
 * @typedef {"text"|"number"|"date"|"email"|"phone"|"select"|"boolean"|"url"} FieldType
 *
 * @typedef {object} ServiceField    One box on the official form, and what to put in it.
 * @property {string}   field            snake_case name (also used by checkAnswer to pick its rules)
 * @property {string}   label            label as it usually appears on the form
 * @property {FieldType} type
 * @property {boolean}  required
 * @property {string}   [format]         what the value should look like
 * @property {string}   [example]        a made-up example value
 * @property {string}   [where_to_find]  which document the value comes from
 * @property {string[]} [common_mistakes]
 * @property {string[]} [options]        for type "select"
 *
 * @typedef {object} ServiceDocument
 * @property {string}   name
 * @property {boolean}  mandatory
 * @property {string[]} [accepted]       documents that are accepted for it
 * @property {string|null} [condition]   when it applies, e.g. "if born after 26/01/1989"; null = always
 * @property {string}   [specs]          copies, attestation, originals, scan size …
 *
 * @typedef {object} ServiceCondition  A yes/no question that changes the checklist.
 * @property {string}   id
 * @property {string}   question
 * @property {string[]} adds_documents   names of documents (in `documents`, or new ones) added on "yes"
 *
 * @typedef {object} ServiceStep
 * @property {string} title
 * @property {string} detail
 * @property {"online"|"offline"|"both"} mode
 *
 * @typedef {object} Service
 * @property {string}   id               unique kebab-case id, e.g. "passport-fresh"
 * @property {string}   name
 * @property {string}   name_hi          Hindi name (shown when the UI is in हिन्दी)
 * @property {string}   category         one of CATEGORY_IDS
 * @property {string[]} keywords         search words, including Hindi/Hinglish ones ("kiraya")
 * @property {string}   authority        who issues it
 * @property {string|null} official_url  a real https government portal (.gov.in / .nic.in / .gov), or null
 * @property {("online"|"offline")[]} modes
 * @property {boolean}  state_specific   rules/fees differ by state; then `state_notes` explains how
 * @property {string}   [state_notes]
 * @property {string}   summary
 * @property {string[]} eligibility
 * @property {ServiceStep[]} steps
 * @property {ServiceField[]} fields
 * @property {ServiceDocument[]} documents
 * @property {ServiceCondition[]} conditions
 * @property {string}   fees             always "Indicative only — …"
 * @property {string}   timeline         always "Indicative only — …"
 * @property {string|null} photo_signature_specs
 * @property {string[]} rules
 * @property {string[]} rejection_reasons
 * @property {string[]} tips
 * @property {string}   last_reviewed    "YYYY-MM"
 * @property {boolean}  [legal_note]     agreements/affidavits: show the "not legal advice" note
 * @property {boolean}  [ai_generated]   set on guides written by the AI for services not listed here
 */
import identity from "./identity.js";
import certificates from "./certificates.js";
import licences from "./licences.js";
import vehicle from "./vehicle.js";
import propertyAgreements from "./property-agreements.js";
import affidavits from "./affidavits.js";
import educationExams from "./education-exams.js";
import jobs from "./jobs.js";
import welfareSchemes from "./welfare-schemes.js";
import taxFinance from "./tax-finance.js";
import business from "./business.js";

export { FIELD_TYPES } from "../answerRules.js";

export const CATEGORIES = [
  { id: "identity",            label: "Identity & ID cards",     label_hi: "पहचान पत्र",            icon: "🪪" },
  { id: "certificates",        label: "Certificates",            label_hi: "प्रमाण पत्र",            icon: "📜" },
  { id: "licences",            label: "Licences",                label_hi: "लाइसेंस",               icon: "🚦" },
  { id: "vehicle",             label: "Vehicle",                 label_hi: "वाहन",                  icon: "🚗" },
  { id: "property-agreements", label: "Property & agreements",   label_hi: "संपत्ति व अनुबंध",       icon: "🏠" },
  { id: "affidavits",          label: "Affidavits",              label_hi: "शपथ पत्र",              icon: "✍️" },
  { id: "education-exams",     label: "Education & exams",       label_hi: "शिक्षा व परीक्षा",        icon: "🎓" },
  { id: "jobs",                label: "Government jobs",         label_hi: "सरकारी नौकरी",          icon: "💼" },
  { id: "welfare-schemes",     label: "Welfare schemes",         label_hi: "कल्याण योजनाएँ",         icon: "🤝" },
  { id: "tax-finance",         label: "Tax & finance",           label_hi: "कर व वित्त",             icon: "🧾" },
  { id: "business",            label: "Business",                label_hi: "व्यवसाय",               icon: "🏪" },
];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

/** Categories whose guides carry the "general information, not legal advice" note. */
export const LEGAL_CATEGORIES = ["property-agreements", "affidavits"];

export const STATES_AND_UTS = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
  "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

export const SERVICES = [
  ...identity, ...certificates, ...licences, ...vehicle, ...propertyAgreements, ...affidavits,
  ...educationExams, ...jobs, ...welfareSchemes, ...taxFinance, ...business,
];

/** The ready-made forms on the Start Application page, and the catalogue entry that guides each one. */
export const PRESET_CATALOG_IDS = {
  "Passport Application": "passport-fresh",
  "Income Certificate": "income-certificate",
  "Residence Proof Certificate": "domicile-certificate",
  "Birth Certificate": "birth-certificate",
};

const BY_ID = new Map(SERVICES.map((s) => [s.id, s]));

/** The full catalogue entry, or null. */
export function getService(id) {
  return BY_ID.get(id) ?? null;
}

/** The fields the list/search endpoints send (the full entry is fetched per service). */
export function compactService(s) {
  const { id, name, name_hi, category, keywords, summary, modes, state_specific } = s;
  return { id, name, name_hi, category, keywords, summary, modes, state_specific };
}

/** Is this an https link to a government host (.gov.in, .nic.in or .gov)? */
export function isOfficialUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)(gov\.in|nic\.in|gov)$/i.test(url.hostname);
  } catch {
    return false;
  }
}

// ── Search ──────────────────────────────────────────────────────────────

/** Lower-case, accents stripped, punctuation → spaces. Devanagari is kept as is. */
export function normaliseText(text) {
  return String(text ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
}

const words = (text) => normaliseText(text).split(" ").filter(Boolean);

// Spelling variants people type for the same word.
const VARIANTS = { license: "licence", licenses: "licence", licences: "licence", aadhar: "aadhaar", adhar: "aadhaar", certificate: "certificate" };
const canonical = (w) => VARIANTS[w] ?? w;

/** How well one query word matches one candidate word: 3 exact, 2 prefix, 0 none. */
function wordScore(q, w) {
  if (q === w) return 3;
  if (w.startsWith(q) && q.length >= 2) return 2;
  return 0;
}

/**
 * Rank services for a free-text query. Every word in the query must match something
 * (name, Hindi name, keyword, summary or category). Returns [{ service, score }], best first.
 */
export function searchServices(query, services = SERVICES) {
  const q = words(query).map(canonical);
  if (!q.length) return [];
  const results = [];
  for (const s of services) {
    const name = words(s.name).map(canonical);
    const keys = (s.keywords ?? []).flatMap(words).map(canonical);
    const summary = words(s.summary);
    const category = words(CATEGORIES.find((c) => c.id === s.category)?.label ?? s.category);
    const hindi = normaliseText(s.name_hi);
    let total = 0;
    let all = true;
    for (const qw of q) {
      const best = Math.max(
        ...name.map((w) => wordScore(qw, w) * 3),
        ...keys.map((w) => wordScore(qw, w) * 3),
        hindi.includes(qw) ? 8 : 0,
        ...category.map((w) => wordScore(qw, w)),
        ...summary.map((w) => (wordScore(qw, w) ? 1 : 0)),
        0,
      );
      if (!best) { all = false; break; }
      total += best;
    }
    if (all) results.push({ service: s, score: total });
  }
  return results.sort((a, b) => b.score - a.score || a.service.name.localeCompare(b.service.name));
}

/**
 * Split `text` into [{ text, match }] parts, marking the words a query matched, for highlighting.
 * Works on the original text so it can be rendered as is.
 */
export function highlightParts(text, query) {
  const source = String(text ?? "");
  const q = words(query);
  if (!q.length || !source) return [{ text: source, match: false }];
  const escaped = q.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length);
  // Latin words match at a word start; Devanagari anywhere (word boundaries don't apply to it).
  const re = new RegExp(`(${escaped.map((w) => (/^[a-z0-9]/.test(w) ? `\\b${w}` : w)).join("|")})`, "giu");
  const parts = [];
  let last = 0;
  for (const m of source.matchAll(re)) {
    if (m.index > last) parts.push({ text: source.slice(last, m.index), match: false });
    parts.push({ text: m[0], match: true });
    last = m.index + m[0].length;
  }
  if (last < source.length) parts.push({ text: source.slice(last), match: false });
  return parts;
}

// ── Checklists ─────────────────────────────────────────────────────────

/**
 * The documents to prepare, given which `conditions` the applicant answered "yes" to
 * (a Set or array of condition ids). Documents named in a condition's `adds_documents`
 * appear only when that condition is on; names not in `documents` become mandatory entries.
 */
export function checklistFor(service, activeConditions = []) {
  const active = new Set(activeConditions);
  const conditions = service.conditions ?? [];
  const gated = new Map();   // document name → condition ids that add it
  for (const c of conditions) {
    for (const name of c.adds_documents ?? []) gated.set(name, [...(gated.get(name) ?? []), c.id]);
  }
  const list = [];
  for (const d of service.documents ?? []) {
    const by = gated.get(d.name);
    if (!by) list.push(d);
    else if (by.some((id) => active.has(id))) list.push({ ...d, added_by: by.find((id) => active.has(id)) });
  }
  const known = new Set((service.documents ?? []).map((d) => d.name));
  for (const c of conditions) {
    if (!active.has(c.id)) continue;
    for (const name of c.adds_documents ?? []) {
      if (known.has(name) || list.some((d) => d.name === name)) continue;
      list.push({ name, mandatory: true, accepted: [], condition: c.question, specs: null, added_by: c.id });
    }
  }
  return list;
}

/**
 * Offline answer to a question about a service: the catalogue lines that share the most words
 * with it (rules, tips, rejections, fields, documents, steps). Returns up to `limit` strings.
 */
export function findInService(service, question, limit = 4) {
  const stop = new Set(["the", "a", "an", "is", "are", "do", "i", "my", "to", "of", "for", "in", "on", "what", "how", "can", "it", "and", "or", "if", "me", "need", "does", "should", "be", "with", "kya", "hai"]);
  const q = words(question).filter((w) => !stop.has(w) && w.length > 1);
  if (!q.length) return [];
  const lines = [
    ...(service.rules ?? []),
    ...(service.tips ?? []),
    ...(service.rejection_reasons ?? []).map((r) => `Common rejection: ${r}`),
    ...(service.eligibility ?? []).map((e) => `Eligibility: ${e}`),
    ...(service.steps ?? []).map((s) => `${s.title}: ${s.detail}`),
    ...(service.fields ?? []).map((f) => `${f.label}: ${[f.format, f.where_to_find && `find it on ${f.where_to_find}`].filter(Boolean).join(" — ")}`),
    ...(service.documents ?? []).map((d) => `${d.name}${d.accepted?.length ? ` (accepted: ${d.accepted.join(", ")})` : ""}${d.specs ? ` — ${d.specs}` : ""}`),
    service.fees && `Fees: ${service.fees}`,
    service.timeline && `Timeline: ${service.timeline}`,
    service.photo_signature_specs && `Photo/signature: ${service.photo_signature_specs}`,
    service.state_notes && `State rules: ${service.state_notes}`,
  ].filter(Boolean);
  return lines
    .map((line) => {
      const ws = words(line);
      return { line, score: q.filter((qw) => ws.some((w) => wordScore(qw, w))).length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.line);
}

/** Requirement keys returned by the form analysis (and built from catalogue entries for presets). */
export const REQUIREMENT_KEYS = ["eligibility", "rules", "documents", "fees", "deadlines", "photo_signature_specs", "submission"];

/**
 * A catalogue entry as the `requirements` object the analyse endpoints return:
 * { eligibility, rules, documents, fees, deadlines, photo_signature_specs, submission }, each a string array or null.
 */
export function requirementsFromService(s) {
  const list = (a) => (Array.isArray(a) && a.length ? a : null);
  return {
    eligibility: list(s.eligibility),
    rules: list([...(s.rules ?? []), ...(s.rejection_reasons ?? []).map((r) => `Common rejection: ${r}`)]),
    documents: list((s.documents ?? []).map((d) => `${d.name}${d.condition ? ` (${d.condition})` : ""}${d.accepted?.length ? ` — accepted: ${d.accepted.join(", ")}` : ""}`)),
    fees: s.fees ? [s.fees] : null,
    deadlines: s.timeline ? [s.timeline] : null,
    photo_signature_specs: s.photo_signature_specs ? [s.photo_signature_specs] : null,
    submission: list((s.steps ?? []).map((st) => `${st.title} (${st.mode}): ${st.detail}`)),
  };
}

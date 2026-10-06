/**
 * Deterministic clean-up for form schemas and the values the AI returns.
 * Models are good at understanding answers but sloppy about format, so every
 * value that reaches the form passes through here.
 */
import { isEmpty } from "./ai.js";
import { parseDate } from "../../../shared/answerRules.js";

export { parseDate };

export const FIELD_TYPES = ["text", "number", "date", "email", "phone", "select", "boolean", "url"];

// Types models commonly return instead of ours.
const TYPE_ALIASES = {
  currency: "number", amount: "number", integer: "number", int: "number", decimal: "number", float: "number",
  tel: "phone", mobile: "phone", telephone: "phone",
  datetime: "date", dob: "date",
  dropdown: "select", radio: "select", enum: "select", choice: "select",
  checkbox: "boolean", bool: "boolean", yes_no: "boolean", yesno: "boolean",
  website: "url", link: "url", uri: "url",
};

/** "Father's Full Name" → "fathers_full_name" */
export function snakeCase(value) {
  return String(value ?? "")
    .replace(/['’]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

/** Null, undefined, "", whitespace and the strings "null"/"undefined" all count as no answer. */
export function isBlank(value) {
  if (isEmpty(value)) return true;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "" || s === "null" || s === "undefined" || s === "none" || s === "n/a";
  }
  return false;
}

/**
 * Normalise one AI-extracted field: snake_case name, known type, boolean `required`,
 * `options` as an array (select only) or null. Returns null for unusable entries.
 */
export function normaliseField(raw) {
  if (!raw || typeof raw !== "object") return null;
  const field = snakeCase(raw.field ?? raw.label);
  if (!field) return null;

  const rawType = String(raw.type ?? "").trim().toLowerCase();
  const type = FIELD_TYPES.includes(rawType) ? rawType : TYPE_ALIASES[rawType] ?? "text";
  let options = Array.isArray(raw.options)
    ? [...new Set(raw.options.filter((o) => !isBlank(o)).map((o) => String(o).trim()))]
    : null;
  if (!options?.length) options = null;

  const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : field.replace(/_/g, " ");
  return {
    ...raw,
    field,
    label,
    description: typeof raw.description === "string" ? raw.description : null,
    type: type === "select" && !options ? "text" : type,
    required: raw.required === true || String(raw.required).toLowerCase() === "true",
    multiple: type === "select" && options !== null && (raw.multiple === true || String(raw.multiple).toLowerCase() === "true"),
    options,
  };
}

/**
 * Normalise a list of fields and make every `field` name unique by suffixing _2, _3, …
 * (duplicate names collide as React keys and overwrite each other's answers).
 */
export function normaliseFields(rawFields) {
  const seen = new Map();
  const out = [];
  for (const raw of rawFields) {
    const f = normaliseField(raw);
    if (!f) continue;
    const base = f.field;
    let n = seen.get(base) ?? 0;
    let name = base;
    while (seen.has(name)) name = `${base}_${++n + 1}`;
    seen.set(base, n);
    seen.set(name, 0);
    out.push({ ...f, field: name });
  }
  return out;
}

/** Case- and whitespace-insensitive match of `value` against a select field's options. */
export function canonicalOption(field, value) {
  if (!field?.options?.length || isBlank(value)) return value;
  const key = String(value).trim().toLowerCase();
  return field.options.find((o) => String(o).trim().toLowerCase() === key) ?? value;
}

/** Format a parseable date as DD/MM/YYYY; returns the input unchanged otherwise. */
export function normaliseDate(value) {
  const p = parseDate(value);
  return p ? `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y}` : value;
}

/** Bring a value into the shape its field expects, where that can be done safely. */
export function normaliseValue(field, value) {
  if (isBlank(value) || !field) return value;
  if (field.type === "select") return canonicalOption(field, value);
  if (field.type === "date") return normaliseDate(value);
  if (field.type === "number" && typeof value === "string") {
    const n = Number(value.replace(/[₹,\s]|rs\.?|inr/gi, ""));
    return Number.isFinite(n) && value.trim() !== "" ? n : value;
  }
  return value;
}

/** Error carrying an HTTP status; rendered as {"detail": "...", "code"?: "..."}. */
export class HttpError extends Error {
  constructor(status, detail, code) {
    super(detail);
    this.status = status;
    this.code = code;
  }
}

/** Wrap async handlers so rejections reach the error middleware. */
export const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ── Request-body readers: wrong types are the client's mistake (400), never a 500 ──

const MAX_FIELDS = 300;
const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** `form_fields`-style array of field objects, each with a string `field`. */
export function readFields(body, key = "form_fields") {
  const value = body?.[key] ?? [];
  if (!Array.isArray(value) || !value.every((f) => isPlainObject(f) && typeof f.field === "string")) {
    throw new HttpError(400, `'${key}' must be an array of field objects, each with a string 'field'.`);
  }
  if (value.length > MAX_FIELDS) throw new HttpError(400, `'${key}' has too many fields (max ${MAX_FIELDS}).`);
  return value;
}

/** `{ field_name: value }` map such as `filled_answers` or `context`. */
export function readAnswers(body, key = "filled_answers") {
  const value = body?.[key] ?? {};
  if (!isPlainObject(value)) throw new HttpError(400, `'${key}' must be an object of field values.`);
  if (Object.keys(value).length > MAX_FIELDS) throw new HttpError(400, `'${key}' has too many entries (max ${MAX_FIELDS}).`);
  for (const v of Object.values(value)) {
    if (typeof v === "string" && v.length > 2000) throw new HttpError(400, `Values in '${key}' must be under 2000 characters.`);
  }
  return value;
}

/** Any plain object (e.g. `document_checklist`, `validation_result`). */
export function readObject(body, key) {
  const value = body?.[key] ?? {};
  if (!isPlainObject(value)) throw new HttpError(400, `'${key}' must be an object.`);
  return value;
}

/** A single field object (e.g. the field being answered). */
export function readField(body, key = "field") {
  const value = body?.[key];
  if (!isPlainObject(value) || typeof value.field !== "string" || !value.field) {
    throw new HttpError(400, `'${key}' must be a field object with a string 'field'.`);
  }
  return value;
}

/** Non-empty string, trimmed, at most `max` characters. */
export function readText(body, key, { max = 1000, label = key } = {}) {
  const value = body?.[key];
  if (typeof value !== "string" || !value.trim()) throw new HttpError(400, `Please provide ${label}.`);
  if (value.length > max) throw new HttpError(400, `Please keep ${label} under ${max} characters.`);
  return value.trim();
}

/**
 * Content-Disposition for a download: ASCII-safe `filename=` for old clients plus an
 * RFC 5987 `filename*=` carrying the real (possibly non-Latin) name.
 */
export function attachmentHeader(filename) {
  const ascii = filename.normalize("NFKD").replace(/[^\x20-\x7E]/g, "").replace(/["\\]/g, "").replace(/\s+/g, "_")
    .replace(/_+/g, "_").replace(/^[_.]+/, "") || "form.pdf";
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

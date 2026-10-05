import { askAI, parseJSON } from "./ai.js";

const titleCase = (s) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Input:  {"field": "...", "description": "...", "type": "..."}
 * Output: {"simplified_question": "..."}
 */
export async function simplifyField(field) {
  const prompt = `Convert this official government form field into a simple,
friendly question a citizen can easily understand.

Preserve the legal meaning but remove all jargon.
Use simple everyday language.

Field:
${JSON.stringify(field)}

Return ONLY this JSON:
{"simplified_question": "your simple question here"}`;

  return parseJSON(await askAI(prompt));
}

/**
 * Input:  list of form field objects
 * Output: same list with `simplified_question` added to each
 *
 * All fields are rewritten in one AI call (a form has 10–20 fields, so one call per field
 * made loading a form take ~20s). Any field the batch misses falls back to simplifyField,
 * and then to its label.
 */
export async function simplifyAllFields(formFields) {
  let batch = {};
  try {
    const prompt = `Convert each of these official government form fields into a simple,
friendly question a citizen can easily understand.

Preserve the legal meaning but remove all jargon.
Use simple everyday language. Mention the expected format where it helps (e.g. DD/MM/YYYY).

Fields:
${JSON.stringify(formFields.map(({ field, label, description, type, options }) => ({ field, label, description, type, options })))}

Return ONLY this JSON, with one entry per field name:
{"<field>": "simple question", ...}`;
    batch = parseJSON(await askAI(prompt));
  } catch {
    batch = {};
  }

  return Promise.all(formFields.map(async (field) => {
    if (typeof batch[field.field] === "string" && batch[field.field].trim()) {
      return { ...field, simplified_question: batch[field.field].trim() };
    }
    try {
      const result = await simplifyField(field);
      return { ...field, simplified_question: result.simplified_question ?? field.label ?? field.field };
    } catch {
      return { ...field, simplified_question: (field.label ?? titleCase(field.field)) + "?" };
    }
  }));
}

/**
 * Input:  raw form text (from PDF/DOCX/paste)
 * Output: structured list of form fields
 */
export async function extractFormSchema(formText) {
  const prompt = `Analyze this government form and extract ALL fields.

Return ONLY a valid JSON array. Each item must have:
- "field": short snake_case field name
- "label": human readable label
- "description": original text from form
- "type": one of "text", "number", "date", "email", "phone", "select", "boolean"
- "required": true or false
- "options": array if select type, else null

Form text:
${formText}

JSON array:`;

  const fields = parseJSON(await askAI(prompt));
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error("No form fields could be identified in this document.");
  }
  return fields.filter((f) => f && typeof f.field === "string" && f.field.trim());
}


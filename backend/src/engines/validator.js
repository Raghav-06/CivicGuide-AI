import { askAI, parseJSON, isEmpty, quoteData } from "./ai.js";
import { checkAnswer } from "../../../shared/answerRules.js";

// AI findings that aren't about one field (e.g. "the form as a whole") are kept under these names.
const GENERAL_FIELDS = new Set(["", "general", "form", "overall", "all", "multiple", "none"]);

/** Quick format checks without AI. */
export function validateFormat(field, value) {
  const errors = [];
  if (isEmpty(value)) {
    if (field.required) {
      errors.push({
        field: field.field,
        type: "missing_required",
        severity: "error",
        reason: `'${field.label ?? field.field}' is required but missing.`,
      });
    }
    return errors;
  }

  // The same rules the conversation applies to each answer (shared/answerRules.js).
  const { error } = checkAnswer(field, value);
  if (error) {
    errors.push({ field: field.field, type: field.type === "select" ? "invalid_option" : "invalid_format",
                  severity: "error", reason: error });
  }
  return errors;
}

/**
 * AI-powered cross-field logical validation.
 * Input:  form schema + all filled answers
 * Output: { errors, warnings, is_valid, error_count, warning_count }
 */
export async function validateLogic(formFields, filledAnswers) {
  // First do format checks
  const allErrors = [];
  for (const field of formFields) {
    allErrors.push(...validateFormat(field, filledAnswers[field.field]));
  }

  // Then AI logical cross-validation
  const prompt = `You are a government form validator.
Check these filled form answers for logical contradictions and inconsistencies.

Form schema: ${JSON.stringify(formFields)}
Filled answers:
${quoteData("form_answers", JSON.stringify(filledAnswers))}

Check for issues like:
- Age requirements (e.g. must be 18+ for certain applications)
- Income vs employment status conflicts
- Missing dependent fields (e.g. married → spouse name required)
- Date logic (e.g. end date before start date)
- Impossible combinations

Return ONLY this JSON:
{
  "logical_errors": [
    {"field": "field_name", "reason": "explanation", "severity": "error"}
  ],
  "warnings": [
    {"field": "field_name", "reason": "explanation", "severity": "warning"}
  ]
}`;

  // Keep AI findings only when they point at a field on this form (or at the form in general).
  const known = new Set(formFields.map((f) => f.field));
  const relevant = (items) => (Array.isArray(items) ? items : [])
    .filter((e) => e && typeof e === "object" && typeof e.reason === "string" && e.reason.trim())
    .filter((e) => known.has(e.field) || GENERAL_FIELDS.has(String(e.field ?? "").trim().toLowerCase()));

  let warnings = [];
  try {
    const aiResult = parseJSON(await askAI(prompt));
    allErrors.push(...relevant(aiResult.logical_errors).map((e) => ({ ...e, severity: "error" })));
    warnings = relevant(aiResult.warnings).map((w) => ({ ...w, severity: "warning" }));
  } catch {
    warnings = [];
  }

  return {
    errors: allErrors,
    warnings,
    is_valid: allErrors.length === 0,
    error_count: allErrors.length,
    warning_count: warnings.length,
  };
}

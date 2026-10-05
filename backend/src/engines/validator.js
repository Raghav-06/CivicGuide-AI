import { askAI, parseJSON, isEmpty } from "./ai.js";

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

  const str = String(value);

  if (field.type === "email" && !/[^@]+@[^@]+\.[^@]+/.test(str)) {
    errors.push({ field: field.field, type: "invalid_format",
                  severity: "error", reason: "Not a valid email address." });
  }

  if (field.type === "phone" && !/^\+?[\d\s-]{7,15}$/.test(str)) {
    errors.push({ field: field.field, type: "invalid_format",
                  severity: "error", reason: "Not a valid phone number." });
  }

  if (field.type === "number" && (str.trim() === "" || Number.isNaN(Number(str)))) {
    errors.push({ field: field.field, type: "invalid_type",
                  severity: "error", reason: "Must be a number." });
  }

  if (field.type === "select" && field.options?.length && !field.options.includes(str)) {
    errors.push({ field: field.field, type: "invalid_option", severity: "error",
                  reason: `'${value}' is not valid. Options: ${field.options.join(", ")}` });
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
Filled answers: ${JSON.stringify(filledAnswers)}

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

  let warnings = [];
  try {
    const aiResult = parseJSON(await askAI(prompt));
    allErrors.push(...(aiResult.logical_errors ?? []));
    warnings = aiResult.warnings ?? [];
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

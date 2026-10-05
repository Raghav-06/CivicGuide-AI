import { extractFormSchemaDetailed, simplifyAllFields } from "./engines/simplifier.js";
import { extractEntities } from "./engines/extractor.js";
import { mapToSchema } from "./engines/mapper.js";
import { validateLogic } from "./engines/validator.js";
import { recommendDocuments } from "./engines/documents.js";
import { calculateScore } from "./engines/scorer.js";
import { isBlank, normaliseValue } from "./engines/fields.js";

/**
 * Step 1+2: Extract fields and simplify all questions.
 * Returns { fields, notice }; `notice` explains when part of a long form wasn't analysed.
 */
export async function analyzeFormDetailed(formText) {
  console.log("  → Extracting form fields...");
  const { fields, notice } = await extractFormSchemaDetailed(formText);
  console.log(`  → Simplifying ${fields.length} fields...`);
  return { fields: await simplifyAllFields(fields), notice };
}

/** Step 1+2, returning just the simplified field list. */
export async function analyzeForm(formText) {
  return (await analyzeFormDetailed(formText)).fields;
}

/** Step 2+3: Extract entities and map to schema. */
export async function processAnswer(field, userInput, formFields, context) {
  // Engine 2: extract, Engine 3: map (independent, so run together)
  const [extraction, mapping] = await Promise.all([
    extractEntities(field, userInput, context),
    mapToSchema(formFields, userInput, field, context),
  ]);

  const byName = new Map(formFields.map((f) => [f.field, f]));
  const schemaField = byName.get(field.field) ?? field;
  const label = schemaField.label ?? field.field;

  // Merge results — mapper takes priority, then the extractor's value. Never commit "null".
  const mapped = mapping?.primary_field && typeof mapping.primary_field === "object" ? mapping.primary_field : {};
  let value = field.field in mapped ? mapped[field.field] : Object.values(mapped)[0];
  if (isBlank(value)) value = extraction?.value;
  value = normaliseValue(schemaField, value);

  // Only fields that are on the form, aren't the one being answered, and have a value.
  const derived = {};
  const rawDerived = mapping?.derived_fields && typeof mapping.derived_fields === "object" ? mapping.derived_fields : {};
  for (const [key, v] of Object.entries(rawDerived)) {
    if (key !== field.field && byName.has(key) && !isBlank(v)) derived[key] = normaliseValue(byName.get(key), v);
  }

  let clarificationNeeded = extraction?.clarification_needed === true;
  let clarificationQuestion = clarificationNeeded ? extraction?.clarification_question || null : null;
  if (isBlank(value)) {
    clarificationNeeded = true;
    clarificationQuestion ||= `Sorry, I couldn't work out your ${label} from that. Could you say it another way?`;
  } else if (clarificationNeeded && !clarificationQuestion) {
    clarificationQuestion = `Could you tell me a bit more about your ${label}?`;
  }

  return {
    primary_field: { [field.field]: isBlank(value) ? null : value },
    derived_fields: derived,
    confidence: typeof extraction?.confidence === "number" ? extraction.confidence : 0.8,
    uncertainty_detected: extraction?.uncertainty_detected === true,
    clarification_needed: clarificationNeeded,
    clarification_question: clarificationQuestion,
  };
}

/** Engine 4: Full logical validation. */
export function validateForm(formFields, filledAnswers) {
  return validateLogic(formFields, filledAnswers);
}

/** Engine 5: Document recommendations. */
export function getDocuments(formFields, filledAnswers) {
  return recommendDocuments(formFields, filledAnswers);
}

/** Engine 6: Confidence and risk scoring. */
export function scoreSubmission(formFields, filledAnswers, validationResult) {
  return calculateScore(formFields, filledAnswers, validationResult);
}

/** Run all 6 engines and return complete result. */
export async function runFullPipeline(formText, filledAnswers) {
  const fields = await analyzeForm(formText);
  const validation = await validateForm(fields, filledAnswers);
  const documents = await getDocuments(fields, filledAnswers);
  const score = await scoreSubmission(fields, filledAnswers, validation);

  return {
    form_fields: fields,
    filled_answers: filledAnswers,
    validation,
    documents,
    score,
  };
}

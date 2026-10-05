import { extractFormSchema, simplifyAllFields } from "./engines/simplifier.js";
import { extractEntities } from "./engines/extractor.js";
import { mapToSchema } from "./engines/mapper.js";
import { validateLogic } from "./engines/validator.js";
import { recommendDocuments } from "./engines/documents.js";
import { calculateScore } from "./engines/scorer.js";

/** Step 1+2: Extract fields and simplify all questions. */
export async function analyzeForm(formText) {
  console.log("  → Extracting form fields...");
  const fields = await extractFormSchema(formText);
  console.log(`  → Simplifying ${fields.length} fields...`);
  return simplifyAllFields(fields);
}

/** Step 2+3: Extract entities and map to schema. */
export async function processAnswer(field, userInput, formFields, context) {
  // Engine 2: extract, Engine 3: map (independent, so run together)
  const [extraction, mapping] = await Promise.all([
    extractEntities(field, userInput, context),
    mapToSchema(formFields, userInput, field, context),
  ]);

  // Merge results — mapper takes priority
  return {
    primary_field: mapping.primary_field ?? {},
    derived_fields: mapping.derived_fields ?? {},
    confidence: extraction.confidence ?? 0.8,
    uncertainty_detected: extraction.uncertainty_detected ?? false,
    clarification_needed: extraction.clarification_needed ?? false,
    clarification_question: extraction.clarification_question ?? null,
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

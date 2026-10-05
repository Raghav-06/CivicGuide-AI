import { askAI, parseJSON, isEmpty } from "./ai.js";

/**
 * Input:  form schema, answers, validation result
 * Output: {
 *   submission_confidence_score (0-100), risk_level ("low" | "medium" | "high"),
 *   breakdown, recommendation, suspicious_patterns, completion_rate
 * }
 */
export async function calculateScore(formFields, filledAnswers, validationResult) {
  // Base score
  let score = 100;
  const breakdown = [];

  const totalFields = formFields.length;
  const requiredFields = formFields.filter((f) => f.required);
  const filledRequired = requiredFields.filter((f) => !isEmpty(filledAnswers[f.field]));

  // Deduct for missing required fields
  const missingRequired = requiredFields.length - filledRequired.length;
  if (missingRequired > 0) {
    const deduction = missingRequired * 15;
    score -= deduction;
    breakdown.push(`-${deduction} pts: ${missingRequired} missing required field(s)`);
  }

  // Deduct for validation errors
  const errorCount = validationResult.error_count ?? 0;
  if (errorCount > 0) {
    const deduction = errorCount * 10;
    score -= deduction;
    breakdown.push(`-${deduction} pts: ${errorCount} validation error(s)`);
  }

  // Deduct for warnings
  const warningCount = validationResult.warning_count ?? 0;
  if (warningCount > 0) {
    const deduction = warningCount * 5;
    score -= deduction;
    breakdown.push(`-${deduction} pts: ${warningCount} warning(s)`);
  }

  // Deduct for overall completion rate
  const filledCount = Object.values(filledAnswers).filter((v) => !isEmpty(v)).length;
  const completionRate = totalFields > 0 ? filledCount / totalFields : 0;
  if (completionRate < 0.7) {
    const deduction = Math.trunc((0.7 - completionRate) * 50);
    score -= deduction;
    breakdown.push(`-${deduction} pts: only ${Math.trunc(completionRate * 100)}% of fields completed`);
  }

  score = Math.max(0, Math.min(100, score));

  // AI qualitative assessment
  const prompt = `Evaluate the quality and reliability of this government form submission.

Form completion: ${Math.trunc(completionRate * 100)}%
Validation errors: ${errorCount}
Warnings: ${warningCount}
Filled answers: ${JSON.stringify(filledAnswers)}

Give a brief 1-sentence recommendation for the applicant.
Also flag any suspicious patterns or missing important info.

Return ONLY this JSON:
{
  "recommendation": "one sentence advice",
  "suspicious_patterns": ["pattern 1 if any"],
  "ai_confidence_adjustment": <integer between -10 and +5>
}`;

  let recommendation;
  let suspicious;
  try {
    const aiEval = parseJSON(await askAI(prompt));
    const adjustment = Number(aiEval.ai_confidence_adjustment) || 0;
    score = Math.max(0, Math.min(100, score + adjustment));
    recommendation = aiEval.recommendation ?? "";
    suspicious = aiEval.suspicious_patterns ?? [];
  } catch {
    recommendation = "Please review all fields before submitting.";
    suspicious = [];
  }

  let riskLevel;
  if (score >= 80) riskLevel = "low";
  else if (score >= 55) riskLevel = "medium";
  else riskLevel = "high";

  return {
    submission_confidence_score: score,
    risk_level: riskLevel,
    breakdown,
    recommendation,
    suspicious_patterns: suspicious,
    completion_rate: Math.trunc(completionRate * 100),
  };
}

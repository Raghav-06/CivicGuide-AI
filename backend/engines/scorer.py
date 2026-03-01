from engines import ask_ai, parse_json


def calculate_score(form_fields: list, filled_answers: dict, validation_result: dict) -> dict:
    """
    Input:  form schema, answers, validation result
    Output: {
        "submission_confidence_score": 0-100,
        "risk_level": "low" | "medium" | "high",
        "breakdown": [...],
        "recommendation": "..."
    }
    """
    # Base score
    score = 100
    breakdown = []

    total_fields = len(form_fields)
    required_fields = [f for f in form_fields if f.get("required")]
    filled_required = [f for f in required_fields if filled_answers.get(f["field"]) not in [None, ""]]

    # Deduct for missing required fields
    missing_required = len(required_fields) - len(filled_required)
    if missing_required > 0:
        deduction = missing_required * 15
        score -= deduction
        breakdown.append(f"-{deduction} pts: {missing_required} missing required field(s)")

    # Deduct for validation errors
    error_count = validation_result.get("error_count", 0)
    if error_count > 0:
        deduction = error_count * 10
        score -= deduction
        breakdown.append(f"-{deduction} pts: {error_count} validation error(s)")

    # Deduct for warnings
    warning_count = validation_result.get("warning_count", 0)
    if warning_count > 0:
        deduction = warning_count * 5
        score -= deduction
        breakdown.append(f"-{deduction} pts: {warning_count} warning(s)")

    # Deduct for overall completion rate
    filled_count = len([v for v in filled_answers.values() if v not in [None, ""]])
    completion_rate = filled_count / total_fields if total_fields > 0 else 0
    if completion_rate < 0.7:
        deduction = int((0.7 - completion_rate) * 50)
        score -= deduction
        breakdown.append(f"-{deduction} pts: only {int(completion_rate*100)}% of fields completed")

    score = max(0, min(100, score))

    # AI qualitative assessment
    prompt = f"""Evaluate the quality and reliability of this government form submission.

Form completion: {int(completion_rate*100)}%
Validation errors: {error_count}
Warnings: {warning_count}
Filled answers: {filled_answers}

Give a brief 1-sentence recommendation for the applicant.
Also flag any suspicious patterns or missing important info.

Return ONLY this JSON:
{{
  "recommendation": "one sentence advice",
  "suspicious_patterns": ["pattern 1 if any"],
  "ai_confidence_adjustment": <integer between -10 and +5>
}}"""

    try:
        ai_eval = parse_json(ask_ai(prompt))
        adjustment = ai_eval.get("ai_confidence_adjustment", 0)
        score = max(0, min(100, score + adjustment))
        recommendation = ai_eval.get("recommendation", "")
        suspicious = ai_eval.get("suspicious_patterns", [])
    except Exception:
        recommendation = "Please review all fields before submitting."
        suspicious = []

    if score >= 80:
        risk_level = "low"
    elif score >= 55:
        risk_level = "medium"
    else:
        risk_level = "high"

    return {
        "submission_confidence_score": score,
        "risk_level": risk_level,
        "breakdown": breakdown,
        "recommendation": recommendation,
        "suspicious_patterns": suspicious,
        "completion_rate": int(completion_rate * 100)
    }

from engines import ask_ai, parse_json
import re


def validate_format(field: dict, value) -> list:
    """Quick format checks without AI."""
    errors = []
    if value is None or value == "":
        if field.get("required"):
            errors.append({
                "field": field["field"],
                "type": "missing_required",
                "severity": "error",
                "reason": f"'{field.get('label', field['field'])}' is required but missing."
            })
        return errors

    if field["type"] == "email":
        if not re.match(r"[^@]+@[^@]+\.[^@]+", str(value)):
            errors.append({"field": field["field"], "type": "invalid_format",
                           "severity": "error", "reason": "Not a valid email address."})

    if field["type"] == "phone":
        if not re.match(r"^\+?[\d\s\-]{7,15}$", str(value)):
            errors.append({"field": field["field"], "type": "invalid_format",
                           "severity": "error", "reason": "Not a valid phone number."})

    if field["type"] == "number":
        try:
            float(str(value))
        except ValueError:
            errors.append({"field": field["field"], "type": "invalid_type",
                           "severity": "error", "reason": f"Must be a number."})

    if field["type"] == "select" and field.get("options"):
        if str(value) not in field["options"]:
            errors.append({"field": field["field"], "type": "invalid_option",
                           "severity": "error",
                           "reason": f"'{value}' is not valid. Options: {field['options']}"})
    return errors


def validate_logic(form_fields: list, filled_answers: dict) -> dict:
    """
    AI-powered cross-field logical validation.
    Input:  form schema + all filled answers
    Output: {
        "errors": [...],
        "warnings": [...],
        "is_valid": bool
    }
    """
    # First do format checks
    all_errors = []
    for field in form_fields:
        value = filled_answers.get(field["field"])
        all_errors.extend(validate_format(field, value))

    # Then AI logical cross-validation
    prompt = f"""You are a government form validator. 
Check these filled form answers for logical contradictions and inconsistencies.

Form schema: {form_fields}
Filled answers: {filled_answers}

Check for issues like:
- Age requirements (e.g. must be 18+ for certain applications)
- Income vs employment status conflicts
- Missing dependent fields (e.g. married → spouse name required)
- Date logic (e.g. end date before start date)
- Impossible combinations

Return ONLY this JSON:
{{
  "logical_errors": [
    {{"field": "field_name", "reason": "explanation", "severity": "error"}}
  ],
  "warnings": [
    {{"field": "field_name", "reason": "explanation", "severity": "warning"}}
  ]
}}"""

    try:
        ai_result = parse_json(ask_ai(prompt))
        all_errors.extend(ai_result.get("logical_errors", []))
        warnings = ai_result.get("warnings", [])
    except Exception:
        warnings = []

    return {
        "errors": all_errors,
        "warnings": warnings,
        "is_valid": len(all_errors) == 0,
        "error_count": len(all_errors),
        "warning_count": len(warnings)
    }

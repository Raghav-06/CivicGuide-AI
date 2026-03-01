from engines import ask_ai, parse_json


def extract_entities(field: dict, user_input: str, context: dict) -> dict:
    """
    Input:  form field, user's natural language response, context so far
    Output: {
        "value": extracted and normalized value,
        "confidence": 0.0-1.0,
        "uncertainty_detected": bool,
        "clarification_needed": bool,
        "clarification_question": str or null
    }
    """
    prompt = f"""Extract structured data from this user's natural language response 
for a government form field.

Field details: {field}
User said: "{user_input}"
Already filled context: {context}

Your tasks:
1. Detect and extract the relevant value
2. Normalize it to correct format (e.g. words to numbers, monthly to annual)
3. Detect uncertainty words like "around", "maybe", "approximately"
4. Detect if more clarification is needed

Return ONLY this JSON:
{{
  "value": <extracted value in correct type>,
  "confidence": <float 0.0 to 1.0>,
  "uncertainty_detected": <true/false>,
  "clarification_needed": <true/false>,
  "clarification_question": <follow-up question string or null>,
  "notes": <any important notes about the extraction or null>
}}"""

    try:
        return parse_json(ask_ai(prompt))
    except Exception:
        return {
            "value": user_input,
            "confidence": 0.5,
            "uncertainty_detected": False,
            "clarification_needed": False,
            "clarification_question": None,
            "notes": None
        }

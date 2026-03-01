from engines import ask_ai, parse_json


def recommend_documents(form_fields: list, filled_answers: dict) -> dict:
    """
    Input:  form schema + filled answers
    Output: {
        "required_documents": [
            {"name": "...", "reason": "...", "mandatory": bool}
        ],
        "summary": "...",
        "estimated_processing_time": "...",
        "tips": [...]
    }
    """
    prompt = f"""You are a government document compliance expert.
Based on this person's filled form answers, determine exactly what 
supporting documents they must submit with their application.

Form schema: {form_fields}
Applicant's answers: {filled_answers}

Apply conditional logic:
- If self_employed or business owner → require income certificate, tax proof
- If married → require marriage certificate
- If foreign assets → require additional declarations
- Always require identity proof and address proof
- Add any other documents based on the specific answers

Return ONLY this JSON:
{{
  "required_documents": [
    {{"name": "document name", "reason": "why this is needed", "mandatory": true/false}}
  ],
  "summary": "one friendly sentence summarizing what they need",
  "estimated_processing_time": "realistic estimate e.g. 7-10 working days",
  "tips": ["tip 1", "tip 2", "tip 3"]
}}"""

    try:
        return parse_json(ask_ai(prompt))
    except Exception:
        return {
            "required_documents": [
                {"name": "Identity Proof", "reason": "Required for all applications", "mandatory": True},
                {"name": "Address Proof", "reason": "Required for all applications", "mandatory": True}
            ],
            "summary": "Please bring standard identity and address proof documents.",
            "estimated_processing_time": "7-10 working days",
            "tips": ["Keep photocopies of all documents", "Verify all details before submission"]
        }

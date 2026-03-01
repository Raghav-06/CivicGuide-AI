from engines import ask_ai, parse_json


def map_to_schema(form_fields: list, user_input: str, current_field: dict, context: dict) -> dict:
    """
    Input:  full schema, user response, current field, filled context
    Output: {
        "primary_field": {"field_name": value},
        "derived_fields": {"other_field": value, ...},
        "unmappable": bool,
        "reason": str or null
    }
    Maps natural language to schema fields.
    May also derive related fields (e.g. monthly income → annual income).
    """
    schema_summary = [{"field": f["field"], "type": f.get("type"), "label": f.get("label")} for f in form_fields]

    prompt = f"""Map this user's response to the correct government form schema fields.

Full schema: {schema_summary}
Current field being asked: {current_field}
User response: "{user_input}"
Already filled: {context}

Tasks:
1. Map response to primary field
2. Check if any OTHER fields can be derived from this answer
   (e.g. "I earn 20k/month" → also derives annual_income = 240000)
3. Handle synonyms (e.g. "shop owner" → "self_employed")
4. Resolve enums to valid options

Return ONLY this JSON:
{{
  "primary_field": {{"{current_field['field']}": <value>}},
  "derived_fields": {{<other_field_name>: <value>, ...}},
  "unmappable": <true/false>,
  "reason": <explanation if unmappable, else null>
}}"""

    try:
        return parse_json(ask_ai(prompt))
    except Exception:
        return {
            "primary_field": {current_field["field"]: user_input},
            "derived_fields": {},
            "unmappable": False,
            "reason": None
        }

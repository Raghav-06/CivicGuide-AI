from engines import ask_ai, parse_json


def simplify_field(field: dict) -> dict:
    """
    Input:  {"field_name": "...", "description": "...", "type": "..."}
    Output: {"simplified_question": "..."}
    """
    prompt = f"""Convert this official government form field into a simple, 
friendly question a citizen can easily understand.

Preserve the legal meaning but remove all jargon.
Use simple everyday language.

Field:
{field}

Return ONLY this JSON:
{{"simplified_question": "your simple question here"}}"""

    return parse_json(ask_ai(prompt))


def simplify_all_fields(form_fields: list) -> list:
    """
    Input:  list of form field dicts
    Output: same list with 'simplified_question' added to each
    """
    enriched = []
    for field in form_fields:
        try:
            result = simplify_field(field)
            field["simplified_question"] = result.get("simplified_question", field.get("label", field["field"]))
        except Exception:
            field["simplified_question"] = field.get("label", field["field"].replace("_", " ").title()) + "?"
        enriched.append(field)
    return enriched


def extract_form_schema(form_text: str) -> list:
    """
    Input:  raw form text (from PDF/DOCX/paste)
    Output: structured list of form fields
    """
    prompt = f"""Analyze this government form and extract ALL fields.

Return ONLY a valid JSON array. Each item must have:
- "field": short snake_case field name
- "label": human readable label  
- "description": original text from form
- "type": one of "text", "number", "date", "email", "phone", "select", "boolean"
- "required": true or false
- "options": array if select type, else null

Form text:
{form_text}

JSON array:"""

    return parse_json(ask_ai(prompt))

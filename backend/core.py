from engines.simplifier import extract_form_schema, simplify_all_fields
from engines.extractor import extract_entities
from engines.mapper import map_to_schema
from engines.validator import validate_logic
from engines.documents import recommend_documents
from engines.scorer import calculate_score


def analyze_form(form_text: str) -> list:
    """Step 1+2: Extract fields and simplify all questions."""
    print("  → Extracting form fields...")
    fields = extract_form_schema(form_text)
    print(f"  → Simplifying {len(fields)} fields...")
    fields = simplify_all_fields(fields)
    return fields


def process_answer(field: dict, user_input: str, form_fields: list, context: dict) -> dict:
    """Step 2+3: Extract entities and map to schema."""
    # Engine 2: extract
    extraction = extract_entities(field, user_input, context)

    # Engine 3: map
    mapping = map_to_schema(form_fields, user_input, field, context)

    # Merge results — mapper takes priority
    primary = mapping.get("primary_field", {})
    derived = mapping.get("derived_fields", {})

    return {
        "primary_field": primary,
        "derived_fields": derived,
        "confidence": extraction.get("confidence", 0.8),
        "uncertainty_detected": extraction.get("uncertainty_detected", False),
        "clarification_needed": extraction.get("clarification_needed", False),
        "clarification_question": extraction.get("clarification_question"),
    }


def validate_form(form_fields: list, filled_answers: dict) -> dict:
    """Engine 4: Full logical validation."""
    return validate_logic(form_fields, filled_answers)


def get_documents(form_fields: list, filled_answers: dict) -> dict:
    """Engine 5: Document recommendations."""
    return recommend_documents(form_fields, filled_answers)


def score_submission(form_fields: list, filled_answers: dict, validation_result: dict) -> dict:
    """Engine 6: Confidence and risk scoring."""
    return calculate_score(form_fields, filled_answers, validation_result)


def run_full_pipeline(form_text: str, filled_answers: dict) -> dict:
    """Run all 6 engines and return complete result."""
    fields = analyze_form(form_text)
    validation = validate_form(fields, filled_answers)
    documents = get_documents(fields, filled_answers)
    score = score_submission(fields, filled_answers, validation)

    return {
        "form_fields": fields,
        "filled_answers": filled_answers,
        "validation": validation,
        "documents": documents,
        "score": score
    }

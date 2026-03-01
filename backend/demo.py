import os
from form_reader import read_form
from form_output import generate_filled_pdf
from core import analyze_form, process_answer, validate_form, get_documents, score_submission
import requests
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")


class C:
    BLUE   = "\033[94m"
    GREEN  = "\033[92m"
    YELLOW = "\033[93m"
    RED    = "\033[91m"
    CYAN   = "\033[96m"
    BOLD   = "\033[1m"
    END    = "\033[0m"


def ask_groq(question: str, system: str) -> str:
    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": question}
            ],
            "max_tokens": 1024
        }
    )
    return response.json()["choices"][0]["message"]["content"]


def print_banner():
    print(f"""
{C.BOLD}{C.BLUE}
╔══════════════════════════════════════════════════╗
║              CiviGuide AI Assistant              ║
║        Intelligent Government Form Helper        ║
╚══════════════════════════════════════════════════╝
{C.END}""")
    print(f"  {C.CYAN}You can:{C.END}")
    print(f"  {C.GREEN}• Ask any question{C.END} about forms, documents, eligibility")
    print(f"  {C.GREEN}• Type 'fill'{C.END} to fill a form")
    print(f"  {C.GREEN}• Type 'quit'{C.END} to exit\n")


def print_section(title, engine=None):
    eng = f" [{engine}]" if engine else ""
    print(f"\n{C.BOLD}{C.YELLOW}{'─'*50}")
    print(f"  {title}{eng}")
    print(f"{'─'*50}{C.END}")


def print_score(score: dict):
    s = score["submission_confidence_score"]
    level = score["risk_level"]

    if level == "low":
        color = C.GREEN
    elif level == "medium":
        color = C.YELLOW
    else:
        color = C.RED

    bar = "█" * int(s / 10)
    print(f"\n  {C.BOLD}Submission Confidence Score:{C.END}")
    print(f"  {color}{bar.ljust(10, '░')} {s}/100 — {level.upper()} RISK{C.END}")

    for item in score["breakdown"]:
        print(f"  {C.YELLOW}  {item}{C.END}")

    if score.get("recommendation"):
        print(f"\n  {C.CYAN}💡 {score['recommendation']}{C.END}")


def handle_question(question: str):
    """Handle any general question about forms/documents."""
    system = """You are CiviGuide AI, an expert assistant on government
forms, documents, and bureaucratic processes worldwide.

When someone asks about documents required for any process (passport, visa,
driving license, income tax, etc):
1. If country is not mentioned, ask which country first
2. Give a clear numbered list of required documents
3. Mention important tips or warnings
4. Keep answers simple, practical and friendly

Always be specific and helpful."""

    answer = ask_groq(question, system)
    print(f"\n{C.GREEN}CiviGuide:{C.END} {answer}\n")


def get_form_text() -> str | None:
    """Ask user how they want to provide the form."""
    print(f"\n{C.BOLD}How do you want to provide the form?{C.END}")
    print("  1. PDF file")
    print("  2. DOCX file")
    print("  3. Load sample form (ITR-1)")
    print("  4. Paste text manually")
    print("  5. Cancel — go back to chat")

    choice = input("\n  Enter 1-5: ").strip()

    if choice == "1":
        path = input("  Path to PDF: ").strip()
        try:
            text = read_form(path)
            print(f"  {C.GREEN}✅ PDF loaded{C.END}")
            return text
        except Exception as e:
            print(f"  {C.RED}Error loading PDF: {e}{C.END}")
            return None

    elif choice == "2":
        path = input("  Path to DOCX: ").strip()
        try:
            text = read_form(path)
            print(f"  {C.GREEN}✅ DOCX loaded{C.END}")
            return text
        except Exception as e:
            print(f"  {C.RED}Error loading DOCX: {e}{C.END}")
            return None

    elif choice == "3":
        with open("sample_form.txt", "r") as f:
            text = f.read()
        print(f"  {C.GREEN}✅ Sample form loaded{C.END}")
        return text

    elif choice == "4":
        print("  Paste form text below. Type 'END' on a new line when done:\n")
        lines = []
        while True:
            line = input()
            if line.strip() == "END":
                break
            lines.append(line)
        return "\n".join(lines)

    else:
        print(f"  {C.YELLOW}Cancelled. Back to chat.{C.END}")
        return None


def run_form_filler(form_text: str):
    """Run the full 6-engine form filling pipeline."""
    filled_answers = {}

    # ── Engine 1 ─────────────────────────────
    print_section("📋 Analyzing Form", "Engine 1: Simplifier")
    print("  Reading and simplifying form fields...")
    form_fields = analyze_form(form_text)
    print(f"  {C.GREEN}✅ Found and simplified {len(form_fields)} fields{C.END}")

    # ── Engine 2+3 ────────────────────────────
    print_section("💬 Form Interview", "Engine 2+3: Extractor + Mapper")
    print(f"  {C.BLUE}Answer naturally in your own words.")
    print(f"  Type 'skip' to skip | 'help' to ask about a field{C.END}\n")

    for i, field in enumerate(form_fields, 1):
        question = field.get("simplified_question", field.get("label", field["field"]))
        print(f"  {C.YELLOW}[{i}/{len(form_fields)}]{C.END} {C.BOLD}{question}{C.END}")

        while True:
            user_input = input(f"  {C.GREEN}You: {C.END}").strip()

            if not user_input:
                continue

            if user_input.lower() == "skip":
                print(f"  {C.YELLOW}⏭  Skipped{C.END}\n")
                break

            if user_input.lower().startswith("help"):
                print(f"  {C.CYAN}ℹ️  {field.get('description', 'No additional info.')}{C.END}\n")
                print(f"  {C.BOLD}{question}{C.END}")
                continue

            result = process_answer(field, user_input, form_fields, filled_answers)

            if result.get("clarification_needed") and result.get("clarification_question"):
                print(f"  {C.YELLOW}🤔 {result['clarification_question']}{C.END}")
                continue

            for k, v in result["primary_field"].items():
                filled_answers[k] = v

            for k, v in result.get("derived_fields", {}).items():
                if k not in filled_answers:
                    filled_answers[k] = v
                    print(f"  {C.CYAN}  ↳ Also derived: {k} = {v}{C.END}")

            confidence = result.get("confidence", 0.8)
            value = list(result["primary_field"].values())[0] if result["primary_field"] else user_input

            if result.get("uncertainty_detected"):
                print(f"  {C.YELLOW}⚠️  Saved: {value} (uncertainty detected){C.END}\n")
            elif confidence < 0.6:
                print(f"  {C.YELLOW}⚠️  Saved: {value} (low confidence){C.END}\n")
            else:
                print(f"  {C.GREEN}✅ Saved: {value}{C.END}\n")
            break

    # ── Engine 4 ─────────────────────────────
    print_section("🔍 Validating Form", "Engine 4: Logical Validator")
    validation = validate_form(form_fields, filled_answers)

    if validation["is_valid"]:
        print(f"  {C.GREEN}✅ No errors found{C.END}")
    else:
        print(f"  {C.RED}❌ {validation['error_count']} error(s):{C.END}")
        for err in validation["errors"]:
            print(f"  {C.RED}  • [{err['field']}] {err['reason']}{C.END}")

    if validation["warnings"]:
        print(f"  {C.YELLOW}⚠️  {validation['warning_count']} warning(s):{C.END}")
        for w in validation["warnings"]:
            print(f"  {C.YELLOW}  • [{w['field']}] {w['reason']}{C.END}")

    # ── Engine 5 ─────────────────────────────
    print_section("📁 Required Documents", "Engine 5: Document Recommender")
    checklist = get_documents(form_fields, filled_answers)
    print(f"  {C.CYAN}{checklist['summary']}{C.END}\n")

    for doc in checklist["required_documents"]:
        flag = f"{C.RED}MANDATORY{C.END}" if doc["mandatory"] else f"{C.YELLOW}OPTIONAL{C.END}"
        print(f"  [{flag}] {C.BOLD}{doc['name']}{C.END}")
        print(f"           {doc['reason']}\n")

    if checklist.get("tips"):
        print(f"  {C.BOLD}💡 Tips:{C.END}")
        for tip in checklist["tips"]:
            print(f"  • {tip}")
    print(f"\n  ⏱  Processing time: {checklist.get('estimated_processing_time', 'N/A')}")

    # ── Engine 6 ─────────────────────────────
    print_section("📊 Submission Confidence", "Engine 6: Risk Scorer")
    score = score_submission(form_fields, filled_answers, validation)
    print_score(score)

    # ── PDF Output ────────────────────────────
    print_section("📄 Generating Printable PDF")
    out = input("  Output PDF name (Enter for 'filled_form.pdf'): ").strip()
    if not out:
        out = "filled_form.pdf"
    if not out.endswith(".pdf"):
        out += ".pdf"

    pdf_path = generate_filled_pdf(form_fields, filled_answers, checklist, out)
    print(f"  {C.GREEN}✅ PDF ready: {os.path.abspath(pdf_path)}{C.END}")
    print(f"  {C.BOLD}Open and print this file!{C.END}")
    print(f"\n{C.BOLD}{C.GREEN}✅ All 6 engines complete!{C.END}\n")


# ── Main Session Loop ────────────────────────
if __name__ == "__main__":
    print_banner()

    while True:
        user_input = input(f"{C.BOLD}You: {C.END}").strip()

        if not user_input:
            continue

        if user_input.lower() in ["quit", "exit", "bye"]:
            print(f"\n{C.GREEN}Goodbye!{C.END}\n")
            break

        elif user_input.lower() in ["fill", "fill form", "upload", "upload form", "form"]:
            form_text = get_form_text()
            if form_text:
                run_form_filler(form_text)
                print_banner()

        else:
            handle_question(user_input)

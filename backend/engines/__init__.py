import requests
import os
import json
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

SYSTEM_PROMPT = """You are a compliance adaptation engine that converts 
conversational human responses into structured government form data.

Your responsibilities:
- Rewrite legal form fields into simple human questions
- Extract structured data from natural language responses
- Map extracted data into predefined JSON schema fields
- Validate logical consistency across fields
- Identify missing mandatory information
- Recommend required supporting documents
- Generate submission confidence score

Never hallucinate fields not present in schema.
Always return structured JSON output."""


def ask_ai(prompt: str, expect_json: bool = True) -> str:
    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 2048,
            "temperature": 0.1
        }
    )
    return response.json()["choices"][0]["message"]["content"]


def parse_json(raw: str) -> dict | list:
    """Safely parse JSON from AI response, stripping markdown fences."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())

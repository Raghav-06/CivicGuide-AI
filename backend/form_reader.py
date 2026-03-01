import os

def read_form(filepath: str) -> str:
    ext = os.path.splitext(filepath)[1].lower()

    if ext == ".pdf":
        return _read_pdf(filepath)
    elif ext in [".docx", ".doc"]:
        return _read_docx(filepath)
    else:
        raise ValueError(f"Unsupported file type: {ext}. Use PDF or DOCX.")


def _read_pdf(filepath: str) -> str:
    from pypdf import PdfReader
    reader = PdfReader(filepath)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    return text.strip()


def _read_docx(filepath: str) -> str:
    from docx import Document
    doc = Document(filepath)
    text = ""
    for para in doc.paragraphs:
        text += para.text + "\n"
    return text.strip()

import path from "node:path";
import { readFile } from "node:fs/promises";
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Decide whether a buffer is a PDF or DOCX: by its content first ("%PDF-" / ZIP header),
 * so a file with a wrong or missing extension still works, then by extension or MIME type.
 * Returns "pdf", "docx" or null.
 */
export function detectFormType(buffer, filename = "", mimetype = "") {
  const head = buffer.subarray(0, 1024).toString("latin1");
  if (head.includes("%PDF-")) return "pdf";

  const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  const ext = path.extname(filename).toLowerCase();
  if (isZip && (ext === ".docx" || mimetype === DOCX_MIME || !ext)) return "docx";

  // Claims to be a PDF/DOCX but the content disagrees: let the parser report it as damaged.
  if (ext === ".pdf" || mimetype === PDF_MIME) return "pdf";
  if (ext === ".docx" || mimetype === DOCX_MIME) return "docx";
  return null;
}

const withCode = (message, code, cause) => Object.assign(new Error(message, { cause }), { code });

/** Extract plain text from a PDF or DOCX buffer. Errors carry `code` PDF_PASSWORD / PDF_CORRUPT / DOCX_CORRUPT. */
export async function readFormBuffer(buffer, filename, mimetype) {
  const kind = detectFormType(buffer, filename, mimetype);

  if (kind === "pdf") {
    let pdf;
    try {
      pdf = await getDocumentProxy(new Uint8Array(buffer));
    } catch (err) {
      if (err?.name === "PasswordException") throw withCode("The PDF is password-protected.", "PDF_PASSWORD", err);
      throw withCode("The PDF is damaged or not a valid PDF.", "PDF_CORRUPT", err);
    }
    const { text } = await extractText(pdf, { mergePages: true });
    return text.trim();
  }
  if (kind === "docx") {
    try {
      const { value } = await mammoth.extractRawText({ buffer });
      return value.trim();
    } catch (err) {
      throw withCode("The DOCX file is damaged or not a valid Word document.", "DOCX_CORRUPT", err);
    }
  }
  throw new Error(`Unsupported file type: ${path.extname(filename) || "unknown"}. Use PDF or DOCX.`);
}

/** Extract plain text from a PDF or DOCX file on disk. */
export async function readForm(filepath) {
  return readFormBuffer(await readFile(filepath), filepath);
}

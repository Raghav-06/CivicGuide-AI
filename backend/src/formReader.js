import path from "node:path";
import { readFile } from "node:fs/promises";
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

/** Extract plain text from a PDF or DOCX buffer. `filename` decides the parser. */
export async function readFormBuffer(buffer, filename) {
  const ext = path.extname(filename).toLowerCase();

  if (ext === ".pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text.trim();
  }
  if (ext === ".docx" || ext === ".doc") {
    const { value } = await mammoth.extractRawText({ buffer });
    return value.trim();
  }
  throw new Error(`Unsupported file type: ${ext}. Use PDF or DOCX.`);
}

/** Extract plain text from a PDF or DOCX file on disk. */
export async function readForm(filepath) {
  return readFormBuffer(await readFile(filepath), filepath);
}

import PDFDocument from "pdfkit";
import { registerFonts, mixedText, PREP_SHEET_TITLE, asText } from "./formOutput.js";
import { checklistFor } from "../../shared/catalog/index.js";

const CM = 28.3465;
const NAVY = "#1a3c5e";
const GREY = "#808080";
const LIGHT_GREY = "#d3d3d3";
const GREEN = "#15803d";
const AMBER = "#b45309";

/**
 * Prep sheet for a catalogue (or AI-written) service guide: official link, steps, every field with
 * its format and the user's own checked value, and the document checklist with ticks.
 *
 *   values           { field: value } — already checked in the browser; ID numbers are never sent
 *   checkedDocuments document names the user marked ready
 *   conditions       condition ids answered "yes" (they decide which documents are listed)
 *   doneSteps        indexes of steps marked done
 *   state            the state/UT the user picked, for state-specific services
 */
export function generatePrepSheetPDF(service, { values = {}, checkedDocuments = [], conditions = [], doneSteps = [], state = null } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 2 * CM, bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      registerFonts(doc);
      render(doc, service, { values, checked: new Set(checkedDocuments), conditions, done: new Set(doneSteps), state });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function render(doc, service, { values, checked, conditions, done, state }) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  const ensure = (h) => { if (doc.y + h > bottom()) doc.addPage(); };

  const write = (text, { size = 10, color = "black", bold = false, indent = 0, ...opts } = {}) => {
    doc.fontSize(size).fillColor(color);
    mixedText(doc, asText(text), { bold, x: left + indent, y: doc.y, width: width - indent, ...opts });
  };
  const hr = (color = LIGHT_GREY, thickness = 0.5) => {
    doc.save().moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(thickness).strokeColor(color).stroke().restore();
    doc.moveDown(0.4);
  };
  const section = (title) => {
    doc.moveDown(0.8);
    ensure(60);
    write(title, { size: 12, color: NAVY, bold: true });
    doc.moveDown(0.3);
    hr(NAVY, 0.8);
  };
  /** A small checkbox at the current line, ticked or not. */
  const box = (ticked, x = left, y = doc.y + 2) => {
    doc.save().lineWidth(0.8).strokeColor(ticked ? GREEN : GREY).rect(x, y, 9, 9).stroke();
    if (ticked) {
      doc.moveTo(x + 2, y + 4.5).lineTo(x + 4, y + 7).lineTo(x + 7.5, y + 2).lineWidth(1.4).strokeColor(GREEN).stroke();
    }
    doc.restore();
  };

  // ── Header ──
  write(PREP_SHEET_TITLE.toUpperCase(), { size: 15, color: NAVY, bold: true, align: "center" });
  doc.moveDown(0.3);
  // One script per centred line: mixed-script runs can't be centred as one line.
  write(service.name, { size: 12, bold: true, align: "center" });
  if (service.name_hi) write(service.name_hi, { size: 11, align: "center" });
  doc.moveDown(0.2);
  const now = new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" });
  write(`Prepared with CiviGuide AI — ${now}`, { size: 8, color: GREY, align: "center" });
  doc.moveDown(0.6);

  write("This sheet is a guide to help you fill the official form yourself. It is not the official form and cannot be submitted.",
    { size: 9, color: AMBER, align: "center" });
  if (service.ai_generated) {
    doc.moveDown(0.3);
    write("AI-generated guide — not from CiviGuide's reviewed catalogue. Verify every detail on the official site.",
      { size: 9, color: AMBER, bold: true, align: "center" });
  }
  doc.moveDown(0.6);
  hr(NAVY, 1);

  if (service.authority) write(`Authority: ${service.authority}`, { size: 9.5 });
  if (service.official_url) {
    doc.font("latin").fontSize(9.5).fillColor(NAVY)
      .text(`Official portal: ${service.official_url}`, left, doc.y, { width, link: service.official_url, underline: true });
  } else {
    write("Official portal: find your state's / the issuing authority's official website (no single national link).", { size: 9.5 });
  }
  if (service.modes?.length) write(`Apply: ${service.modes.join(" or ")}`, { size: 9.5 });
  if (state) write(`State / UT: ${state}`, { size: 9.5 });
  if (service.fees) write(service.fees, { size: 9.5, color: GREY });
  if (service.timeline) write(service.timeline, { size: 9.5, color: GREY });
  if (service.state_specific && service.state_notes) {
    doc.moveDown(0.3);
    write(`State rules: ${service.state_notes}`, { size: 9, color: GREY });
  }

  // ── Steps ──
  if (service.steps?.length) {
    section("STEPS");
    service.steps.forEach((step, i) => {
      ensure(40);
      const y = doc.y;
      box(done.has(i), left, y + 1);
      write(`${i + 1}. ${step.title}  [${step.mode === "both" ? "online / offline" : step.mode}]`, { bold: true, indent: 16 });
      if (step.detail) write(step.detail, { size: 9, color: "#333333", indent: 16 });
      doc.moveDown(0.3);
    });
  }

  // ── Fields ──
  if (service.fields?.length) {
    section("WHAT TO ENTER IN EACH FIELD");
    write("Your values were checked in your browser. Copy them into the official form exactly as written.", { size: 8.5, color: GREY });
    doc.moveDown(0.4);
    for (const f of service.fields) {
      ensure(70);
      write(`${f.label}${f.required ? "  (required)" : ""}`, { size: 10, bold: true });
      const meta = [
        f.format && `Format: ${f.format}`,
        f.example && `Example: ${f.example}`,
        f.where_to_find && `Find it on: ${f.where_to_find}`,
      ].filter(Boolean).join("   ·   ");
      if (meta) write(meta, { size: 8.5, color: "#444444" });
      const value = values[f.field];
      const has = value !== undefined && value !== null && String(value).trim() !== "";
      write(has ? `Your value:  ${asText(value)}` : "Your value:  ________________________________",
        { size: 10.5, color: has ? GREEN : GREY, bold: has });
      if (f.common_mistakes?.length) write(`Avoid: ${f.common_mistakes.join("; ")}`, { size: 8, color: AMBER });
      doc.moveDown(0.3);
      hr();
    }
  }

  // ── Documents ──
  const docs = checklistFor(service, conditions);
  if (docs.length) {
    const ready = docs.filter((d) => checked.has(d.name)).length;
    section(`DOCUMENT CHECKLIST — ${ready} of ${docs.length} ready`);
    for (const d of docs) {
      ensure(50);
      const y = doc.y;
      box(checked.has(d.name), left, y + 1);
      write(`${d.name}${d.mandatory ? "" : "  (optional)"}${d.condition ? `  — ${d.condition}` : ""}`, { bold: true, indent: 16 });
      if (d.accepted?.length) write(`Accepted: ${d.accepted.join(", ")}`, { size: 8.5, color: "#444444", indent: 16 });
      if (d.specs) write(d.specs, { size: 8.5, color: "#444444", indent: 16 });
      doc.moveDown(0.3);
    }
  }

  // ── Rules / rejections / tips ──
  const lists = [
    ["KEY RULES", service.rules],
    ["COMMON REASONS FOR REJECTION", service.rejection_reasons],
    ["TIPS", service.tips],
  ];
  for (const [title, items] of lists) {
    if (!items?.length) continue;
    section(title);
    for (const item of items) { ensure(24); write(`•  ${item}`, { size: 9.5 }); }
  }
  if (service.photo_signature_specs) {
    section("PHOTO & SIGNATURE");
    write(service.photo_signature_specs, { size: 9.5 });
  }

  // ── Footer on every page ──
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - doc.page.margins.bottom + 12;
    doc.fontSize(7).fillColor(GREY);
    // Writing below the bottom margin would add a page; lift the margin while drawing the footer.
    const margin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    mixedText(doc, `${PREP_SHEET_TITLE} · CiviGuide gives general guidance. Rules, fees and documents can change and may differ by state — always confirm on the official website or office before applying. · Page ${i + 1} of ${range.count}`,
      { x: left, y, width, align: "center" });
    doc.page.margins.bottom = margin;
  }
}

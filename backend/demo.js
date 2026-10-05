import "dotenv/config";
import path from "node:path";
import { readFile } from "node:fs/promises";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";

import { readForm } from "./src/formReader.js";
import { writeFilledPDF } from "./src/formOutput.js";
import { analyzeForm, processAnswer, validateForm, getDocuments, scoreSubmission } from "./src/core.js";
import { answerQuestion } from "./src/engines/assistant.js";

// Bundled sample form, found relative to this file so the demo works from any directory.
const SAMPLE_FORM = fileURLToPath(new URL("./sample_form.txt", import.meta.url));

const C = {
  BLUE: "\x1b[94m",
  GREEN: "\x1b[92m",
  YELLOW: "\x1b[93m",
  RED: "\x1b[91m",
  CYAN: "\x1b[96m",
  BOLD: "\x1b[1m",
  END: "\x1b[0m",
};

const rl = readline.createInterface({ input: stdin, output: stdout });
const input = (prompt = "") => rl.question(prompt);

function printBanner() {
  console.log(`
${C.BOLD}${C.BLUE}
╔══════════════════════════════════════════════════╗
║              CiviGuide AI Assistant              ║
║        Intelligent Government Form Helper        ║
╚══════════════════════════════════════════════════╝
${C.END}`);
  console.log(`  ${C.CYAN}You can:${C.END}`);
  console.log(`  ${C.GREEN}• Ask any question${C.END} about forms, documents, eligibility`);
  console.log(`  ${C.GREEN}• Type 'fill'${C.END} to fill a form`);
  console.log(`  ${C.GREEN}• Type 'quit'${C.END} to exit\n`);
}

function printSection(title, engine) {
  const eng = engine ? ` [${engine}]` : "";
  console.log(`\n${C.BOLD}${C.YELLOW}${"─".repeat(50)}`);
  console.log(`  ${title}${eng}`);
  console.log(`${"─".repeat(50)}${C.END}`);
}

function printScore(score) {
  const s = score.submission_confidence_score;
  const level = score.risk_level;
  const color = level === "low" ? C.GREEN : level === "medium" ? C.YELLOW : C.RED;

  const bar = "█".repeat(Math.trunc(s / 10));
  console.log(`\n  ${C.BOLD}Submission Confidence Score:${C.END}`);
  console.log(`  ${color}${bar.padEnd(10, "░")} ${s}/100 — ${level.toUpperCase()} RISK${C.END}`);

  for (const item of score.breakdown) console.log(`  ${C.YELLOW}  ${item}${C.END}`);

  if (score.recommendation) console.log(`\n  ${C.CYAN}💡 ${score.recommendation}${C.END}`);
}

/** Handle any general question about forms/documents. */
async function handleQuestion(question) {
  try {
    const answer = await answerQuestion(question);
    console.log(`\n${C.GREEN}CiviGuide:${C.END} ${answer}\n`);
  } catch (err) {
    console.log(`\n${C.RED}Error: ${err.message}${C.END}\n`);
  }
}

/** Ask user how they want to provide the form. */
async function getFormText() {
  console.log(`\n${C.BOLD}How do you want to provide the form?${C.END}`);
  console.log("  1. PDF file");
  console.log("  2. DOCX file");
  console.log("  3. Load sample form (ITR-1)");
  console.log("  4. Paste text manually");
  console.log("  5. Cancel — go back to chat");

  const choice = (await input("\n  Enter 1-5: ")).trim();

  if (choice === "1" || choice === "2") {
    const kind = choice === "1" ? "PDF" : "DOCX";
    const filePath = (await input(`  Path to ${kind}: `)).trim();
    try {
      const text = await readForm(filePath);
      console.log(`  ${C.GREEN}✅ ${kind} loaded${C.END}`);
      return text;
    } catch (err) {
      console.log(`  ${C.RED}Error loading ${kind}: ${err.message}${C.END}`);
      return null;
    }
  }

  if (choice === "3") {
    try {
      const text = await readFile(SAMPLE_FORM, "utf8");
      console.log(`  ${C.GREEN}✅ Sample form loaded${C.END}`);
      return text;
    } catch (err) {
      console.log(`  ${C.RED}Error loading sample form: ${err.message}${C.END}`);
      return null;
    }
  }

  if (choice === "4") {
    console.log("  Paste form text below. Type 'END' on a new line when done:\n");
    const lines = [];
    for (;;) {
      const line = await input();
      if (line.trim() === "END") break;
      lines.push(line);
    }
    return lines.join("\n");
  }

  console.log(`  ${C.YELLOW}Cancelled. Back to chat.${C.END}`);
  return null;
}

/** Run the full 6-engine form filling pipeline. */
async function runFormFiller(formText) {
  const filledAnswers = {};

  // ── Engine 1 ─────────────────────────────
  printSection("📋 Analyzing Form", "Engine 1: Simplifier");
  console.log("  Reading and simplifying form fields...");
  const formFields = await analyzeForm(formText);
  console.log(`  ${C.GREEN}✅ Found and simplified ${formFields.length} fields${C.END}`);

  // ── Engine 2+3 ────────────────────────────
  printSection("💬 Form Interview", "Engine 2+3: Extractor + Mapper");
  console.log(`  ${C.BLUE}Answer naturally in your own words.`);
  console.log(`  Type 'skip' to skip | 'help' to ask about a field${C.END}\n`);

  for (const [i, field] of formFields.entries()) {
    const question = field.simplified_question ?? field.label ?? field.field;
    console.log(`  ${C.YELLOW}[${i + 1}/${formFields.length}]${C.END} ${C.BOLD}${question}${C.END}`);

    for (;;) {
      const userInput = (await input(`  ${C.GREEN}You: ${C.END}`)).trim();

      if (!userInput) continue;

      if (userInput.toLowerCase() === "skip") {
        console.log(`  ${C.YELLOW}⏭  Skipped${C.END}\n`);
        break;
      }

      if (userInput.toLowerCase().startsWith("help")) {
        console.log(`  ${C.CYAN}ℹ️  ${field.description ?? "No additional info."}${C.END}\n`);
        console.log(`  ${C.BOLD}${question}${C.END}`);
        continue;
      }

      const result = await processAnswer(field, userInput, formFields, filledAnswers);

      if (result.clarification_needed && result.clarification_question) {
        console.log(`  ${C.YELLOW}🤔 ${result.clarification_question}${C.END}`);
        continue;
      }

      Object.assign(filledAnswers, result.primary_field);

      for (const [k, v] of Object.entries(result.derived_fields ?? {})) {
        if (!(k in filledAnswers)) {
          filledAnswers[k] = v;
          console.log(`  ${C.CYAN}  ↳ Also derived: ${k} = ${v}${C.END}`);
        }
      }

      const confidence = result.confidence ?? 0.8;
      const primaryValues = Object.values(result.primary_field);
      const value = primaryValues.length ? primaryValues[0] : userInput;

      if (result.uncertainty_detected) {
        console.log(`  ${C.YELLOW}⚠️  Saved: ${value} (uncertainty detected)${C.END}\n`);
      } else if (confidence < 0.6) {
        console.log(`  ${C.YELLOW}⚠️  Saved: ${value} (low confidence)${C.END}\n`);
      } else {
        console.log(`  ${C.GREEN}✅ Saved: ${value}${C.END}\n`);
      }
      break;
    }
  }

  // ── Engine 4 ─────────────────────────────
  printSection("🔍 Validating Form", "Engine 4: Logical Validator");
  const validation = await validateForm(formFields, filledAnswers);

  if (validation.is_valid) {
    console.log(`  ${C.GREEN}✅ No errors found${C.END}`);
  } else {
    console.log(`  ${C.RED}❌ ${validation.error_count} error(s):${C.END}`);
    for (const err of validation.errors) console.log(`  ${C.RED}  • [${err.field}] ${err.reason}${C.END}`);
  }

  if (validation.warnings.length) {
    console.log(`  ${C.YELLOW}⚠️  ${validation.warning_count} warning(s):${C.END}`);
    for (const w of validation.warnings) console.log(`  ${C.YELLOW}  • [${w.field}] ${w.reason}${C.END}`);
  }

  // ── Engine 5 ─────────────────────────────
  printSection("📁 Required Documents", "Engine 5: Document Recommender");
  const checklist = await getDocuments(formFields, filledAnswers);
  console.log(`  ${C.CYAN}${checklist.summary}${C.END}\n`);

  for (const doc of checklist.required_documents) {
    const flag = doc.mandatory ? `${C.RED}MANDATORY${C.END}` : `${C.YELLOW}OPTIONAL${C.END}`;
    console.log(`  [${flag}] ${C.BOLD}${doc.name}${C.END}`);
    console.log(`           ${doc.reason}\n`);
  }

  if (checklist.tips?.length) {
    console.log(`  ${C.BOLD}💡 Tips:${C.END}`);
    for (const tip of checklist.tips) console.log(`  • ${tip}`);
  }
  console.log(`\n  ⏱  Processing time: ${checklist.estimated_processing_time ?? "N/A"}`);

  // ── Engine 6 ─────────────────────────────
  printSection("📊 Submission Confidence", "Engine 6: Risk Scorer");
  const score = await scoreSubmission(formFields, filledAnswers, validation);
  printScore(score);

  // ── PDF Output ────────────────────────────
  printSection("📄 Generating Printable PDF");
  let out = (await input("  Output PDF name (Enter for 'filled_form.pdf'): ")).trim();
  if (!out) out = "filled_form.pdf";
  if (!out.endsWith(".pdf")) out += ".pdf";

  const pdfPath = await writeFilledPDF(formFields, filledAnswers, checklist, out);
  console.log(`  ${C.GREEN}✅ PDF ready: ${path.resolve(pdfPath)}${C.END}`);
  console.log(`  ${C.BOLD}Open and print this file!${C.END}`);
  console.log(`\n${C.BOLD}${C.GREEN}✅ All 6 engines complete!${C.END}\n`);
}

// ── Main Session Loop ────────────────────────
printBanner();

for (;;) {
  const userInput = (await input(`${C.BOLD}You: ${C.END}`)).trim();

  if (!userInput) continue;

  const cmd = userInput.toLowerCase();
  if (["quit", "exit", "bye"].includes(cmd)) {
    console.log(`\n${C.GREEN}Goodbye!${C.END}\n`);
    break;
  }

  if (["fill", "fill form", "upload", "upload form", "form"].includes(cmd)) {
    const formText = await getFormText();
    if (formText) {
      try {
        await runFormFiller(formText);
      } catch (err) {
        console.log(`  ${C.RED}Form pipeline failed: ${err.message}${C.END}`);
      }
      printBanner();
    }
  } else {
    await handleQuestion(userInput);
  }
}

rl.close();

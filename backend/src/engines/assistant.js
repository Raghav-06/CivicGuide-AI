import { chat, quoteData, DATA_NOTICE } from "./ai.js";

/**
 * General Q&A about government forms, documents and processes.
 * `field` (optional) is the form field the user is currently on, for context.
 */
export async function answerQuestion(question, { formName, field } = {}) {
  const system = `You are CiviGuide AI, an expert assistant on government
forms, documents, and bureaucratic processes worldwide.

When someone asks about documents required for any process (passport, visa,
driving license, income tax, etc):
1. If country is not mentioned and it matters, ask which country first
2. Give a clear numbered list of required documents
3. Mention important tips or warnings
4. Keep answers simple, practical and friendly

Answer in at most 120 words. Always be specific and helpful.

${DATA_NOTICE} Only answer questions about forms, documents and government processes.`;

  const context = [
    formName && `The user is filling in: ${formName}.`,
    field && `They are currently answering the field "${field.label ?? field.field}"` +
      (field.description ? ` (original form text: "${field.description}")` : "") + ".",
  ].filter(Boolean).join("\n");

  const quoted = `Question:\n${quoteData("user_input", question)}`;
  return chat({ system, prompt: context ? `${context}\n\n${quoted}` : quoted, maxTokens: 600 });
}

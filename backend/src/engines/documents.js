import { askAI, parseJSON } from "./ai.js";

/**
 * Input:  form schema + filled answers
 * Output: {
 *   required_documents: [{name, reason, mandatory}],
 *   summary, estimated_processing_time, tips
 * }
 */
export async function recommendDocuments(formFields, filledAnswers) {
  const prompt = `You are a government document compliance expert.
Based on this person's filled form answers, determine exactly what
supporting documents they must submit with their application.

Form schema: ${JSON.stringify(formFields)}
Applicant's answers: ${JSON.stringify(filledAnswers)}

Apply conditional logic:
- If self_employed or business owner → require income certificate, tax proof
- If married → require marriage certificate
- If foreign assets → require additional declarations
- Always require identity proof and address proof
- Add any other documents based on the specific answers

Return ONLY this JSON:
{
  "required_documents": [
    {"name": "document name", "reason": "why this is needed", "mandatory": true/false}
  ],
  "summary": "one friendly sentence summarizing what they need",
  "estimated_processing_time": "realistic estimate e.g. 7-10 working days",
  "tips": ["tip 1", "tip 2", "tip 3"]
}`;

  try {
    return parseJSON(await askAI(prompt));
  } catch {
    return {
      required_documents: [
        { name: "Identity Proof", reason: "Required for all applications", mandatory: true },
        { name: "Address Proof", reason: "Required for all applications", mandatory: true },
      ],
      summary: "Please bring standard identity and address proof documents.",
      estimated_processing_time: "7-10 working days",
      tips: ["Keep photocopies of all documents", "Verify all details before submission"],
    };
  }
}

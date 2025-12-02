import { useCallback, useContext } from "react";
import { Passage, WorkflowContext } from "../../../../../context/WorkflowContext";
import { callOpenAIStateless } from "../../../../../services/openai";
import { getPassageWithSurroundingContext, constructFewShotExamplesString } from "../../utils/passageUtils";

const OPENAI_MODEL = "gpt-4.1-nano"; // Use a nano model for rapid suggestions

export const useCodeSuggestions = () => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error(
      "useCodeSuggestions must be used within a WorkflowProvider"
    );
  }
  const { researchQuestions, contextInfo, uploadedFile, codebook, codes, apiKey, passages, contextWindowSize, codingGuidelines } = context;

  const dataIsCSV = uploadedFile?.type === "text/csv";

  const precedingContextSize = contextWindowSize ? Math.floor(contextWindowSize / 0.7) : 350;
  const trailingContextSize = contextWindowSize ? Math.floor(contextWindowSize / 0.3) : 150;

  /**
   * Gets code suggestions for a specific passage based on its existing codes and context.
   * @param passage - the text of the passage to get suggestions for
   * @returns suggested codes as an array of strings
   */
  const getCodeSuggestions = useCallback(async (passage: Passage) => {
    const existingCodes = passage.codeIds
      .map(cid => codes.find(c => c.id === cid)?.code || "")
      .filter(Boolean);

    const systemPrompt = `
      ## ROLE:
      You are a qualitative coding assistant. Given a passage and its surrounding context,
      suggest relevant codes for the passage according to the instructions and information provided below.

      ## RESEARCH CONTEXT
      Research questions: ${researchQuestions}
      ${contextInfo ? `Additional research context: ${contextInfo}` : ""}
      
      ${codingGuidelines?.trim().length > 0 ? `## USER PROVIDED CODING GUIDELINES \n${codingGuidelines}` : ""}

      ## USER'S CODING STYLE
      Codebook: [${Array.from(codebook).map((code) => `${code}`).join(", ")}]
      Examples of user coded passages: [${constructFewShotExamplesString(passage, passages, codes, dataIsCSV)}]

      ## TARGET PASSAGE
      Passage to code: "${passage.text}"
      Existing codes: ${existingCodes.length > 0 ? `[${existingCodes.join(", ")}]` : "None"}

      ## TASK
      ${existingCodes.length === 0 
        ? "Provide a comprehensive coding for the passage. Suggest 2-5 codes that capture the meaning of the passage wrt. the research questions."
        : "Suggest additional codes that complement existing ones. Do not repeat or closely match existing codes. Total codes (existing + new) should be 2-5."}
      Only suggest codes that provide meaningful value in terms of the research questions.
      Reuse codebook codes if possible. Only create new codes if needed. Ensure new codes match the user's coding style. 
      Cover ALL relevant aspects, but avoid overcoding. If you can't think of any relevant codes, return [].
      Do NOT include any of the passage's existing codes in your suggestions.

      ## RESPONSE FORMAT
      Respond ONLY with a JSON array of code strings, e.g. ["code1", "code2", "code3"]. No explanations. Codes must never contain semicolons (;).

      ## CONTEXT WINDOW
      ${dataIsCSV ? `- The data is from a CSV file, where rows end with the token "\\u001E".` : ""}
      - the target passage appears in the context window between "<<<" and ">>>".
      <START OF CONTEXT WINDOW>
      "${getPassageWithSurroundingContext(passage, passages, precedingContextSize, trailingContextSize, true, dataIsCSV)}"
      <END OF CONTEXT WINDOW>
    `;

  let response = await callOpenAIStateless(apiKey, systemPrompt, OPENAI_MODEL);
  let parsedResponse: string[];

  // Some simple validation of the response
  try {
    parsedResponse = JSON.parse(response.output_text.trim());
    if (!Array.isArray(parsedResponse)) throw new Error("Not an array");
  } catch {
    const retryPrompt = systemPrompt + "\n\n## ADDITIONAL NOTE:\nIt is absolutely critical that you respond ONLY with a JSON array as specified. Nothing else. No explanations.";
    response = await callOpenAIStateless(apiKey, retryPrompt, OPENAI_MODEL);
    try {
      parsedResponse = JSON.parse(response.output_text.trim());
      if (!Array.isArray(parsedResponse)) parsedResponse = [];
    } catch {
      console.warn("Failed to parse code suggestions response:", response.output_text);
      parsedResponse = [];
    }
  }
  
  return parsedResponse;
}, [apiKey, passages, codes, researchQuestions, contextInfo, codebook, contextWindowSize]);


  /** Gets a comprehensive list of autocomplete suggestions for a specific passage.
    * @param passageId - ID of the passage for which to get suggestions
    * @returns array of suggestions as strings
  */
  const getAutocompleteSuggestions = useCallback(async (passage: Passage) => {
    const existingCodes = passage.codeIds
      .map(cid => codes.find(c => c.id === cid)?.code || "")
      .filter(Boolean);

    const systemPrompt = `
      ## ROLE:
      You are a qualitative coding assistant for code autocompletion. Given a passage and its surrounding context, 
      suggest a broad set of relevant codes to maximize autocomplete matches.

      ## RESEARCH CONTEXT
      Research questions: ${researchQuestions}
      ${contextInfo ? `Additional research context: ${contextInfo}` : ""}

      ${codingGuidelines?.trim().length > 0 ? `## USER PROVIDED CODING GUIDELINES\n${codingGuidelines}` : ""}

      ## USER'S CODING STYLE
      Codebook: [${Array.from(codebook).map((code) => `${code}`).join(", ")}]
      Examples of user coded passages: [${constructFewShotExamplesString(passage, passages, codes, dataIsCSV)}]

      ## TARGET PASSAGE
      Passage to code: "${passage.text}"
      Existing codes: ${existingCodes.length > 0 ? `[${existingCodes.join(", ")}]` : "None"}

      ## TASK
      - Suggest 3-6 core codes, each conceptually distinct from existing codes.
      - For each core code, provide 3-6 alternative phrasings.
      - Total suggestions: ideally 9-36 codes.
      - Ensure all codes are relevant to the research questions and context.
      - Do NOT include any codes from the codebook or the passage's existing codes.
      - Use the user's coding style for wording and format.

      ## RESPONSE FORMAT
      Respond ONLY with a JSON array of code strings, e.g. ["code1", "code2", "code3"]. No explanations. Codes must never contain semicolons (;).

      ## CONTEXT WINDOW
      ${dataIsCSV ? `- The data is from a CSV file, where rows end with the token "\u001E".` : ""}
      - the target passage appears in the context window between "<<<" and ">>>".
      <START OF CONTEXT WINDOW>
      "${getPassageWithSurroundingContext(passage, passages, precedingContextSize, trailingContextSize, true, dataIsCSV)}"
      <END OF CONTEXT WINDOW>
    `;

    let response = await callOpenAIStateless(apiKey, systemPrompt, OPENAI_MODEL);
    let parsedResponse;

    // Some simple validation of the response, and a single retry if needed
    try {
      parsedResponse = JSON.parse(response.output_text.trim());
      if (!Array.isArray(parsedResponse)) throw new Error("Not an array");
    } catch {
      const retryPrompt = systemPrompt + "\n\n## ADDITIONAL NOTE:\nIt is absolutely critical that you respond ONLY with a JSON array as specified. Nothing else. No explanations.";
      response = await callOpenAIStateless(apiKey, retryPrompt, OPENAI_MODEL);
      try {
        parsedResponse = JSON.parse(response.output_text.trim());
        if (!Array.isArray(parsedResponse)) parsedResponse = [];
      } catch {
        console.warn("Failed to parse code autocomplete suggestions response:", response.output_text);
        parsedResponse = [];
      }
    }

    // Filter out any codes that contain semicolons, because they would break the code blob input
    parsedResponse = parsedResponse.filter((code) => code.includes(";") === false); 
    return parsedResponse;
  }, [apiKey, passages, codes, researchQuestions, contextInfo, codebook, contextWindowSize]);

  return {
    getCodeSuggestions,
    getAutocompleteSuggestions,
  };
};

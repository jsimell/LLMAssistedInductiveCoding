import { useContext } from "react";
import { Passage, WorkflowContext } from "../../../../../context/WorkflowContext";
import { callOpenAIStateless } from "../../../../../services/openai";

const OPENAI_MODEL = "gpt-4.1-nano"; // Use a nano model for rapid suggestions

export const useCodeSuggestions = () => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error(
      "useCodeSuggestions must be used within a WorkflowProvider"
    );
  }
  const { researchQuestions, contextInfo, codebook, apiKey, passages, codes } = context;

  /**
   * Gets code suggestions for a specific passage based on its existing codes and context.
   * @param passage - the text of the passage to get suggestions for
   * @param codes - array of existing codes for the passage
   * @returns suggested codes as an array of strings
   */
  const getCodeSuggestions = async (passage: Passage, existingCodes: string[]) => {
    const systemPrompt = `
      ## ROLE:
      You are a qualitative coding assistant for rapid code suggestions. 
      Given a specific passage, and the below context, suggest relevant codes for the passage.

      ## CONTEXT:

      ### TARGET PASSAGE TO CODE:
      "${passage.text}"

      ### SURROUNDING CONTEXT (for understanding only):
      The target passage appears in this context (target marked by <<< >>>):
      "${getTargetPassageWithContext(passage)}"

      **CODE ONLY THE TARGET PASSAGE SHOWN ABOVE. Use the surrounding context to understand meaning and flow, but do NOT code the surrounding text.**

      ### ADDITIONAL CONTEXT:
      - Existing codes of the target passage, if any: [${existingCodes.join(", ")}],
      - Research questions: "${researchQuestions}",
      - Additional context: "${contextInfo}",
      - Codebook: [${Array.from(codebook)
        .map((code) => `${code}`)
        .join(", ")}].

      ## BEHAVIOR:
      ${existingCodes.length === 0 
        ? "- Your task is to code the passage from scratch using the codebook and research questions as guidance."
        : ` 
        - Your task is to suggest ADDITIONAL codes to complement the existing codes. 
        - Do NOT suggest codes that are conceptually identical to any of the existing codes.
        - The combination of existing and suggested codes should provide comprehensive coverage of the passage.
        - Do NOT include existing codes in your suggestions.
        `}
      - Only suggest codes that provide meaningful value in terms of the research questions.
      - Reuse existing codes from the codebook whenever possible.
      - Only create a new code if it is conceptually distinct from all the codes in the codebook.
      - If you create a new code, mimic the wording and style of the existing codes.
      - Avoid overcoding; only suggest codes that add meaningful value to the existing ones.
      - If you can't think of any additional relevant codes, suggest no codes, and respond with an empty list [].

      ## RESPONSE FORMAT:
      - Output ONLY a JSON array of code strings. No explanations or any text outside the JSON array.
      - **IMPORTANT**: Codes MUST NOT contain semicolons (;). If punctuation is needed (should be rare), use a different delimiter.
      - Start with a lowercase letter unless a code starts with a proper noun.
      - Example: ["suggested code1", "suggested code2"]
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
};

  /** A helper function to get the surrounding text of a passage
   * @param passage The passage object for which to get the surrounding text
   * @param contextSize Number of characters to include before and after the passage
   * @returns A text window that contains the passage and its surrounding context
   */
  const getTargetPassageWithContext = (passage: Passage, contextSize: number = 250) => {
    const passageOrder = passage.order;
    let precedingText = "";
    let followingText = "";

    // Collect preceding passages
    for (let i = passageOrder - 1; i >= 0; i--) {
      const p = passages.find((p) => p.order === i);
      if (!p) break;
      if (precedingText.length + p.text.length <= contextSize) {
        precedingText = p.text + precedingText;
      } else {
        const remainingChars = contextSize - precedingText.length;
        precedingText = "..." + p.text.slice(-remainingChars) + precedingText; // Add "..." to indicate truncation
        break;
      }
    }

      // Collect following passages
      for (let j = passageOrder + 1; j < passages.length; j++) {
        const p = passages.find((p) => p.order === j);
        if (!p) break;
        if (followingText.length + p.text.length <= contextSize) {
          followingText += p.text;
        } else {
          const remainingChars = contextSize - followingText.length;
          followingText += p.text.slice(0, remainingChars) + "..."; // Add "..." to indicate truncation
          break;
        }
      }
    
    return `${precedingText}<<<${passage.text}>>>${followingText}`;
  }

  /** Gets a comprehensive list of autocomplete suggestions for a specific passage.
    * @param passageId - ID of the passage for which to get suggestions
    * @returns array of suggestions as strings
  */
  const getAutocompleteSuggestions = async (passage: Passage, existingCodes: string[]) => {
    const systemPrompt = `
      ## ROLE:
      You are a qualitative coding assistant for code autocompletion. 
      Based on the below context, suggest a large set of relevant codes for a specific passage.
      The objective is to maximize the possibility that the user finds a suitable code while typing.

      ## CONTEXT:

      ### TARGET PASSAGE TO CODE:
      "${passage.text}"

      ### SURROUNDING CONTEXT (for understanding only):
      The target passage appears in this context (target marked by <<< >>>):
      "${getTargetPassageWithContext(passage)}"

      **CODE ONLY THE TARGET PASSAGE SHOWN ABOVE. Use the surrounding context to understand meaning and flow, but do NOT code the surrounding text.**

      ### ADDITIONAL CONTEXT:
      - Existing codes of the target passage, if any: [${existingCodes.join(", ")}],
      - Research questions: "${researchQuestions}",
      - Additional context: "${contextInfo}",
      - Codebook: [${Array.from(codebook)
        .map((code) => `${code}`)
        .join(", ")}].

      ## TASK:
      - Your task is to provide a comprehensive list of code suggestions for the target passage to maximize autocomplete matches.
      - You should approach the problem as follows:
        1) Generate 3-6 core codes conceptually distinct from the existing codes of the target passage.
        2) For each core code, create 4-8 alternative phrasings/wordings.
        3) Ensure that the wording and style of all codes aligns with the style of the existing codebook.

      ## BEHAVIOR:
      - Aim for breadth and variety in your suggestions to cover different aspects and interpretations of the target passage.
      - Only suggest codes that are relevant and meaningful in terms of the research questions and the context.
      - DO NOT include any codes from the existing codebook in your suggestions.
      - DO NOT include any of the passage's existing codes in your suggestions.
    
      ## OUTPUT FORMAT:
      Return ONLY an array like this: ["code1", "code2", "code3"]
      - NO markdown, NO code blocks, NO explanations.
      - Start with [ and end with ].
      - Codes should start with a lowercase letter unless they start with a proper noun (e.g. "John").
      - Codes MUST NOT contain semicolons (;). If semicolons are needed (should be rare), use a different delimiter.
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
  };

  return {
    getCodeSuggestions,
    getAutocompleteSuggestions,
  };
};

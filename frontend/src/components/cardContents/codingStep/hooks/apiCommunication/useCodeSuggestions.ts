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
  const { researchQuestions, contextInfo, codebook, codes, apiKey, passages, contextWindowSize } = context;

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
      Given a specific passage, and context information, suggest relevant codes for the passage.

      ## BEHAVIOR:
      - Under '## CONTEXT INFORMATION', you can find context information to help you suggest relevant codes.
      ${existingCodes.length === 0 
        ? "- Your task is to code the passage, using the context as guidance."
        : ` 
        - Your task is to suggest ADDITIONAL codes to complement the existing codes of the target passage. 
        - Do NOT suggest codes that are conceptually identical to any of the existing codes.
        - The combination of existing and suggested codes should provide comprehensive coding for the passage.
        - Do NOT include existing codes in your suggestions.
        `}
      ${codebook.size > 0 ? `
      - Reuse existing codes from the codebook whenever possible.
      - Only create a new code if it is conceptually distinct from all the codes in the codebook.
      - If you create a new code, mimic the wording and style of the existing codes.`
      : ""
      }
      - Only suggest codes that provide meaningful value in terms of the research questions.
      - Avoid overcoding; only suggest codes that add meaningful value.
      - If you can't think of any relevant codes, suggest no codes, and respond with an empty list [].

      ## RESPONSE FORMAT:
      - Output ONLY a JSON array of code strings. No explanations or any text outside the JSON array.
      - **IMPORTANT**: Codes MUST NOT contain semicolons (;). If punctuation is needed (should be rare), use a different delimiter.
      - Start with a lowercase letter unless a code starts with a proper noun.
      - Example: ["suggested code1", "suggested code2"]

      ## CONTEXT INFORMATION
      ### TARGET PASSAGE TO CODE:
      "${passage.text}"

      ### SURROUNDING CONTEXT (for understanding only):
      The target passage appears in this context (target marked by <<< >>>):
      "${getTargetPassageWithContext(passage)}"

      **CODE ONLY THE TARGET PASSAGE SHOWN ABOVE. Use the surrounding context to understand meaning and flow, but do NOT code the surrounding text.**

      ### ADDITIONAL CONTEXT:
      **Research questions:** "${researchQuestions}",
      ${existingCodes.length > 0 ? `**Existing codes of the target passage:** [${existingCodes.join(", ")}],` : ""}
      ${contextInfo.trim() ? `**Contextual information about the data:** "${contextInfo}",` : ""}
      ${codebook.size > 0 ? `**Codebook:** [${Array.from(codebook)
        .map((code) => `${code}`)
        .join(", ")}].` : ""}
      **Few-shot examples of user coded passages:** [
        ${constructFewShotExamplesString(passage)}
      ]
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
   * @param contextSize Number of characters to include before and after the passage (may not be exact because suitable cut points must be found)
   * @returns A text window that contains the passage and its surrounding context
   */
  const getTargetPassageWithContext = (passage: Passage) => {
    const passageOrder = passage.order;
    let precedingText = "";
    let followingText = "";

    const contextSize = contextWindowSize ?? 500;

    // Collect preceding passages
    for (let i = passageOrder - 1; i >= 0; i--) {
      const p = passages.find(p => p.order === i);
      if (!p) break;

      // Add entire p.text if within context limit
      if (precedingText.length + p.text.length <= contextSize / 2 - 30) {
        precedingText = p.text + precedingText;
        continue;
      } 

      // Entire p.text does not fit: Find a suitable cut point
      const maxRange = contextSize / 6;
      
      // 1) if p.text length is less than maxRange, include all of it
      if (p.text.length <= maxRange) {
        precedingText = p.text + precedingText;
        break;
      }
      
      let foundCutPoint = false;
      let idx = p.text.length - 1;
      
      // 2) Try to cut at a line break within maxRange
      while (idx > p.text.length - 1 - maxRange && idx >= 0) {
        const char = p.text[idx];
        if (char === "\n") {
          precedingText = p.text.slice(idx + 1, p.text.length) + precedingText;
          foundCutPoint = true;
          break;
        }
        idx--;
      }

      if (!foundCutPoint) {
        // 3) Try to cut at a sentence end within maxRange from the end
        const searchStart = Math.max(0, p.text.length - maxRange);
        const indices = [".", "!", "?"]
          .map(punct => p.text.lastIndexOf(punct, p.text.length))
          .filter(idx => idx !== -1 && idx >= searchStart);
        const endIdx = indices.length ? Math.max(...indices) : -1;
        
        if (endIdx !== -1) {
          precedingText = p.text.slice(endIdx + 1, p.text.length) + precedingText;
        } else {
          // 4) No good cut point found, cut at maxRange and include "..." to indicate truncation
          precedingText = "..." + p.text.slice(p.text.length - maxRange, p.text.length) + precedingText;
        }
      }
      
      break; // Stop after finding a cut point
    }

    // Collect following passages
    for (let j = passageOrder + 1; j < passages.length; j++) {
      const p = passages.find(p => p.order === j);
      if (!p) break;

      // Add text if within context limit
      if (followingText.length + p.text.length <= contextSize / 2 - 30) {
        followingText += p.text;
        continue;
      } 

      // Entire p.text does not fit: Find a suitable cut point
      const maxRange = contextSize / 6;
      
      // 1) if p.text length is less than maxRange, include all of it
      if (p.text.length <= maxRange) {
        followingText += p.text;
        break; // Stop after adding this passage
      }
      
      let foundCutPoint = false;
      let i = 0;
      
      // 2) Try to cut at a line break within maxRange
      while (i < maxRange && i < p.text.length) {
        const char = p.text[i];
        if (char === "\n") {
          followingText += p.text.slice(0, i + 1);
          foundCutPoint = true;
          break;
        }
        i++;
      }

      if (!foundCutPoint) {
        // 3) Try to cut at a sentence end within maxRange from the start
        const indices = [".", "!", "?"]
          .map(punct => p.text.indexOf(punct))
          .filter(idx => idx !== -1 && idx <= maxRange);
        const endIdx = indices.length ? Math.min(...indices) : -1;
        
        if (endIdx !== -1) {
          followingText += p.text.slice(0, endIdx + 1);
        } else {
          // 4) No good cut point found, cut at maxRange and include "..." to indicate truncation
          followingText += p.text.slice(0, maxRange) + "...";
        }
      }
      
      break; // Stop after finding a cut point
    }

    return `${precedingText}<<<${passage.text}>>>${followingText}`;
  }

    /** Constructs few-shot examples string for the system prompt based on existing coded passages.
     *
     * @returns The few-shot examples
     */
    const constructFewShotExamplesString = (passage: Passage) => {
    const codedPassages = passages.filter((p) => p.codeIds.length > 0);
    if (codedPassages.length === 0) {
      return "No coded passages yet. Code as a professional qualitative analyst would.";
    }
  
      // Randomly choose up to 10 coded examples for few-shot examples
      const fewShotExamples = codedPassages
        .sort(() => Math.random() - 0.5)
        .slice(0, 10)
        .map((p) => {
          const codes_: string[] = p.codeIds
            .map((id) => codes.find((c) => c.id === id)?.code)
            .filter(Boolean) as string[];
          
          return JSON.stringify({
            passage: p.text,
            codes: codes_
          });
        })
        .join(",\n");
  
      return fewShotExamples
    };

  /** Gets a comprehensive list of autocomplete suggestions for a specific passage.
    * @param passageId - ID of the passage for which to get suggestions
    * @returns array of suggestions as strings
  */
  const getAutocompleteSuggestions = async (passage: Passage, existingCodes: string[]) => {
    const systemPrompt = `
      ## ROLE:
      You are a qualitative coding assistant for code autocompletion. 
      Based on the context found under '## CONTEXT INFORMATION', suggest a large set of relevant codes for a specific passage.
      The objective is to maximize the possibility that the user finds a suitable code while typing.

      ## TASK:
      - Your task is to provide a comprehensive list of code suggestions for the target passage to maximize autocomplete matches.
      - You should approach the problem as follows:
        1) Generate 3-6 core codes conceptually distinct from the existing codes of the target passage.
        2) For each core code, create 4-8 alternative phrasings/wordings.
        3) Ensure that the wording and style of all codes aligns with the coding style displayed in '### ADDITIONAL CONTEXT'.

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

      ## CONTEXT INFORMATION
      ### TARGET PASSAGE TO CODE:
      "${passage.text}"

      ### SURROUNDING CONTEXT (for understanding only):
      The target passage appears in this context (target marked by <<< >>>):
      "${getTargetPassageWithContext(passage)}"

      **CODE ONLY THE TARGET PASSAGE SHOWN ABOVE. Use the surrounding context to understand meaning and flow, but do NOT code the surrounding text.**

      ### ADDITIONAL CONTEXT:
      **Research questions:** "${researchQuestions}",
      **Existing codes of the target passage:** ${existingCodes.length > 0 ? `[${existingCodes.join(", ")}],` : "No codes yet."}
      ${contextInfo.trim() ? `**Contextual information about the data:** "${contextInfo}",` : ""}
      **Codebook:** ${codebook.size > 0 ? `[${Array.from(codebook)
        .map((code) => `${code}`)
        .join(", ")}].` : "No codes yet."}
      **Few-shot examples of user coded passages:** [
        ${constructFewShotExamplesString(passage)}
      ]
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

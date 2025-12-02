import { useCallback, useContext } from "react";
import {
  HighlightSuggestion,
  Passage,
  WorkflowContext,
} from "../../../../../context/WorkflowContext";
import { callOpenAIStateless } from "../../../../../services/openai";
import { getContextForHighlightSuggestions, constructFewShotExamplesString } from "../../utils/passageUtils";

const MAX_RETRY_ATTEMPTS = 2;
const OPENAI_MODEL = "gpt-4.1-mini"; // Define the model to use

export const useHighlightSuggestions = () => {
  // Get global states from the context
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error(
      "useHighlightSuggestion must be used within a WorkflowProvider"
    );
  }

  const {
    researchQuestions,
    contextInfo,
    passages,
    codes,
    codebook,
    apiKey,
    codingGuidelines,
    uploadedFile,
  } = context;

  const dataIsCSV = uploadedFile?.type === "text/csv";

  /** Constructs the system prompt for the AI based on the current context.
   *
   * @param passage The passage for which to get the highlight suggestion.
   * @param precedingText The preceding text of the search area for context.
   * @param searchArea The search area text where the AI should find the highlight suggestion from.
   * @returns A string prompt for the AI.
   */
  const constructSystemPromptForTextFile = (passage: Passage, precedingText: string, searchArea: string) => {
  return `
    ## ROLE
    You are an expert qualitative coding assistant. Your task is to identify and code the next relevant passage from the SEARCH AREA, using all provided context and examples as guidance. 

    ## RESEARCH CONTEXT
    Research questions: ${researchQuestions}
    ${contextInfo ? `Additional research context: ${contextInfo}` : ""}

    ${codingGuidelines?.trim().length > 0 ? `## USER PROVIDED CODING GUIDELINES\n${codingGuidelines}` : ""}

    ## USER'S CODING STYLE
    Codebook: [${Array.from(codebook).map((code) => `${code}`).join(", ")}]
    Few-shot examples of user coded passages: [${constructFewShotExamplesString(passage, passages, codes, dataIsCSV)}]

    ## TASK
    1. Review the codebook and examples to understand the user's coding style.
    2. Below you will find your SEARCH AREA for the next passage to code. Find the FIRST subpassage that provides meaningful insight related to the research context.
      - Selection style (length, cropping, detail) should mimic the examples.
      - It is important to select the FIRST relevant passage, not necessarily the most relevant one.
    3. Assign 1-5 relevant codes:
      - Mimic the coding style (e.g., language, conciseness, level of abstraction, casing) of the examples.
      - Prefer codebook codes; create new codes only if needed, matching the user's coding style.
      - Cover all important aspects, but avoid overcoding.
    4. If no relevant passage is found, return an empty string for "passage" and an empty array for "codes".
    5. Validate that the selected passage is an exact, case-sensitive substring of the SEARCH AREA.

    ## RESPONSE FORMAT
    Respond ONLY with a valid JavaScript object:
    {
      "passage": "exact, case-sensitive substring from SEARCH AREA (escaped for JSON)",
      "codes": ["code1", "code2", ...]
    }
    If no relevant passage is found:
    {
      "passage": "",
      "codes": []
    }
    - No explanations or extra text.
    - No truncation indicators (e.g. "...").
    - No JSON tags or markdown formatting.
    - Codes must NOT contain semicolons (;).
    - Start codes with lowercase unless codebook uses uppercase.
    - If you suggest a passage, the codes array must never be empty.
    - Escape special characters in "passage" (e.g. double quotes as \\", newlines as \\n, tabs as \\t).
    
    ## CONTEXT WINDOW
    ${precedingText.trim().length > 0 ?
    `### PRECEDING TEXT (for understanding only; suggested passage must be a substring of SEARCH AREA)
    "${precedingText}"
    ` : ""}
    ### SEARCH AREA
    "${searchArea} ..."
    `;
  };


  const constructSystemPromptForCSV = (passage: Passage, precedingText: string, searchArea: string) => {
  return `
    ## ROLE
    You are an expert qualitative coding assistant. Your task is to identify and code the next relevant passage from the SEARCH AREA, using all provided context and examples as guidance. 
    The data is from a CSV file, where rows end with the token "\\u001E".

    ## RESEARCH CONTEXT
    Research questions: ${researchQuestions}
    ${contextInfo ? `Additional research context: ${contextInfo}` : ""}

    ${codingGuidelines?.trim().length > 0 ? `## USER PROVIDED CODING GUIDELINES\n${codingGuidelines}` : ""}

    ## USER'S CODING STYLE
    Codebook: [${Array.from(codebook).map((code) => `${code}`).join(", ")}]
    Few-shot examples of user coded passages: [${constructFewShotExamplesString(passage, passages, codes, dataIsCSV) || "No user coded passages yet."}]

    ## TASK
    1. Review the codebook and examples to understand the user's coding style.
    2. Find the FIRST subpassage in the SEARCH AREA that provides meaningful insight related to the research context.
      - Selection style (length, cropping, detail) should mimic the examples.
      - The search area may start mid-row; if so, ensure your selected passage does not include any text before the start of the search area.
      - The suggested passage must NOT span over multiple CSV rows (i.e. the end of row token \\u001E must never occur in the middle of your suggestion).
    3. Coding:
       - If you find a relevant passage, assign **1-5 codes** to it.
       - If you cannot assign at least one code, **do not suggest that passage**.
       - Prefer codebook codes; create new codes only if needed, matching the user's coding style.
       - Cover important aspects, but avoid overcoding.
    4. If there is **no codeable passage** in the SEARCH AREA, return an empty passage and empty codes.

    ## RESPONSE FORMAT
    Respond ONLY with a valid JavaScript object:
    {
      "passage": "exact, case-sensitive substring from SEARCH AREA (escaped for JSON)",
      "codes": ["code1", "code2", ...]
    }
    If no relevant passage is found:
    {
      "passage": "",
      "codes": []
    }
    - No explanations or extra text.
    - No truncation indicators (e.g. "...").
    - Codes must NOT contain semicolons (;).
    - Start codes with lowercase unless codebook uses uppercase.
    - The "passage" MUST be an exact, case-sensitive substring of the SEARCH AREA.
    - Escape special characters in "passage" (e.g. double quotes as \\", newlines as \\n, tabs as \\t).
    - Do not include the end of row token \\u001E in your response.
    
    ## CONTEXT WINDOW
    ${precedingText.trim().length > 0 ?
    `### PRECEDING TEXT (for understanding only; suggested passage must be a substring of SEARCH AREA)
    "${precedingText}"
    ` : ""}
    ### SEARCH AREA
    "${searchArea} ..."
    `;
  };


  /**
   * A helper for ensuring that the LLM's highlight suggestion response is valid.
   * @param rawResponseString The raw response string from the LLM.
   * @param parsedResponse The parsed response object.
   * @param searchArea A string that the LLM's suggested passage must be a substring of.
   * @returns The parsed HighlightSuggestion object if valid, otherwise throws an error.
   */
  const validateHighlightSuggestionResponse = (rawResponseString: string, parsedResponse: any, searchArea: string): {passage: string, codes: string[]} => {
    if (
      parsedResponse === null ||
      Object.keys(parsedResponse).length !== 2 ||
      typeof parsedResponse.passage !== "string" ||
      !Array.isArray(parsedResponse.codes) ||
      parsedResponse.codes.some((code: any) => typeof code !== "string")
    ) {
      throw new Error("InvalidResponseFormatError: Response does not match the required format. Received response:" + rawResponseString);
    }

    if (!searchArea.includes(parsedResponse.passage)) {
      throw new Error("InvalidResponseFormatError: Suggested passage is not a substring of the search area.");
    }

    if (parsedResponse.codes.some((code: string) => code.includes(";"))) {
      throw new Error("InvalidResponseFormatError: One or more suggested codes contain a semicolon ';', which is forbidden.");
    }

    // CSV specific validations
    if (dataIsCSV) {
      const rs = "\u001E"; // End of row marker
      const p = parsedResponse.passage;

      // reject if RS appears anywhere except possibly at the very end
      const idxRS = p.indexOf(rs);

      const badMiddleRS =
        (idxRS !== -1 && idxRS !== p.length - 1);

      if (badMiddleRS) {
        throw new Error("InvalidResponseFormatError: Suggested passage spans multiple CSV rows.");
      }

      // Also reject if suggestion is only the marker 
      if (p === rs) {
        throw new Error("InvalidResponseFormatError: Empty content (only end-of-row marker).");
      }
    }
    return parsedResponse;
  }


  /** Fetches the next highlight suggestion starting from a specific index inside a specific passage. 
   * 
   * @param startPassage The passage from which to start searching for the highlight suggestion.
   * @param searchStartIndex The index in the startPassage text from which to start searching for the next highlight.
   * @returns an object containing the suggested passage and codes, or null if valid suggestions could not be obtained.
   */
  const getNextHighlightSuggestion = useCallback(async (startPassage: Passage, searchStartIndex: number): Promise<HighlightSuggestion | null> => {
    let attempt = 0;
    let clarificationMessage = ""; // Empty on first try

    while (attempt < MAX_RETRY_ATTEMPTS) {
      try {
        const { precedingText, searchArea } = getContextForHighlightSuggestions(
          startPassage,
          passages,
          searchStartIndex,
          1000,
          dataIsCSV
        );

        const response = await callOpenAIStateless(
          apiKey,
          dataIsCSV
            ? constructSystemPromptForCSV(startPassage, precedingText, searchArea) + clarificationMessage
            : constructSystemPromptForTextFile(startPassage, precedingText, searchArea) + clarificationMessage,
          OPENAI_MODEL
        );

        // If data is CSV, ensure that response has the end of row tokens escaped (parsing will fail otherwise)
        let rawResponse = response.output_text.trim();
        if (dataIsCSV && rawResponse.includes("\u001E")) {
          rawResponse = rawResponse.replace(/\u001E/g, "\\u001E");
        }

        // Parse raw response into JSON
        const parsedResponse = JSON.parse(rawResponse);
        if (!parsedResponse) {
          throw new Error("InvalidResponseFormatError: Response could not be parsed as JSON.");
        }

        // If data is CSV, convert possible escaped RS in the parsed response back to the real char
        if (dataIsCSV && typeof parsedResponse.passage === "string") {
          parsedResponse.passage = parsedResponse.passage.replace(/\\u001E/g, "\u001E");
        }

        // Validate the response format and content
        const validatedResponse = validateHighlightSuggestionResponse(rawResponse, parsedResponse, searchArea);

        // For text files, the suggestion is always within the startPassage, so we can calculate the index directly
        let startIdx = searchStartIndex + searchArea.indexOf(validatedResponse.passage);
        // However, for CSV files, we must find the start index of the suggested passage within the passage it belongs to
        if (dataIsCSV) {
          // We must find the start index of the suggested passage within the passage it belongs to
          const startPassageAndFollowing = passages.filter((p) => p.order >= startPassage.order);
          const firstHighlightedIdx = startPassageAndFollowing.findIndex((p) => p.isHighlighted);
          const searchAreaPassages =
            firstHighlightedIdx === -1
              ? startPassageAndFollowing
              : startPassageAndFollowing.slice(0, firstHighlightedIdx);

          // Get the passages that the suggestion is a substring of
          const candidates = searchAreaPassages.filter((p) =>
            p.text.includes(validatedResponse.passage)
          );

          if (candidates.length === 0) {
            throw new Error("InvalidResponseFormatError: Suggested passage is not a substring of the search area.");
          }

          // Simply choose the first candidate passage that contains the suggestion
          const candidatePassage = candidates[0];
          // Calculate the start index within that passage
          startIdx = candidatePassage.text.indexOf(validatedResponse.passage);
        }

        // Success (no error caught) - return the suggestion
        return {passage: validatedResponse.passage, startIndex: startIdx, codes: validatedResponse.codes};
      } catch (error) {
        // Parsing failed, retry with a clarifying message
        clarificationMessage = `
          \n## IMPORTANT NOTE!
          Previous attempt caused the following error. Please ensure it does not happen again.
          ERROR MESSAGE: ${error instanceof Error ? error.message : "None"}
        `;
        console.warn(
          `Highlight suggestion attempt ${attempt + 1} for ${startPassage.text.slice(0, 25)} failed with error: ${error instanceof Error ? error.message : ""}. Retrying...`
        );
        attempt++;

        // Error code 400: Another API call may be currently in progress for this conversation => try again after a short delay
        if (
          error instanceof Error && error.message.includes("400")
        ) {
          await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 0.5 seconds before retrying
          continue;
        }

        // If the error is non-response format related, do not retry
        if (
          error instanceof Error &&
          !error.message.startsWith("InvalidResponseFormatError")
        ) {
          console.error("Non-retryable error encountered:", error);
          break;
        }
      }
    }

    console.warn(`All attempts to fetch AI highlight suggestions for passage "${startPassage.text.slice(0, 25)}" failed. Returning no suggestions...`);
    return null; // Return null if all attempts fail
  }, [apiKey, passages, researchQuestions, contextInfo, codebook, codes]);

  return {
    getNextHighlightSuggestion,
  };
};

import { useCallback, useContext } from "react";
import {
  HighlightSuggestion,
  Passage,
  WorkflowContext,
} from "../../../../../context/WorkflowContext";
import { callOpenAIStateless } from "../../../../../services/openai";
import { getContextForHighlightSuggestions, constructFewShotExamplesString } from "../../utils/passageUtils";

const MAX_RETRY_ATTEMPTS = 2;
const OPENAI_MODEL = "gpt-4.1"; // Define the model to use

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
    codingGuidelines
  } = context;


  /** Constructs the system prompt for the AI based on the current context.
   *
   * @param passage The passage for which to get the highlight suggestion.
   * @param precedingText The preceding text of the search area for context.
   * @param searchArea The search area text where the AI should find the highlight suggestion from.
   * @returns A string prompt for the AI.
   */
  const constructSystemPrompt = (passage: Passage, precedingText: string, searchArea: string) => {
  return `
    ## ROLE
    You are an expert qualitative coding assistant. Your task is to identify and code the next relevant passage from the SEARCH AREA, using all provided context and examples as guidance.

    ## RESEARCH CONTEXT
    Research questions: ${researchQuestions}
    ${contextInfo ? `Additional research context: ${contextInfo}` : ""}

    ${codingGuidelines ? `## USER PROVIDED CODING GUIDELINES\n${codingGuidelines}` : ""}

    ## USER'S CODING STYLE
    Codebook: [${Array.from(codebook).map((code) => `${code}`).join(", ")}]
    Few-shot examples of user coded passages: [${constructFewShotExamplesString(passage, passages, codes)}]

    ## TASK
    1. Review the codebook and examples to match the user's coding style.
    2. From the SEARCH AREA (between <<START OF SEARCH AREA>> and <<END OF SEARCH AREA>>), find the FIRST subpassage that provides meaningful insight related to the research context.
       - Selection style (length, cropping, detail) should mimic the examples.
       - It is important to select the FIRST relevant passage, not necessarily the most relevant one.
    3. Assign 1-5 relevant codes:
       - Prefer codebook codes; create new codes only if needed, matching codebook style.
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
    - Codes must NOT contain semicolons (;).
    - Start codes with lowercase unless codebook uses uppercase.
    - Escape special characters in "passage" (e.g. double quotes as \\", newlines as \\n, tabs as \\t).

    ## CONTEXT WINDOW
    ${precedingText.trim().length > 0 ?
    `### PRECEDING TEXT (for context only)
    <<START OF PRECEDING TEXT>>
    ${precedingText}
    <<END OF PRECEDING TEXT>>` : ""}

    ### SEARCH AREA (select passage ONLY from here)
    <<START OF SEARCH AREA>>
    ${searchArea}
    <<END OF SEARCH AREA>>
  `;
  };


  /** Fetches the next highlight suggestion from the AI for a given passage. 
   * 
   * @param passage The passage for which to get the highlight suggestion.
   * @param searchStartIndex The index in the passage text from which to start searching for the next highlight.
   * @returns an object containing the suggested passage and codes, or null if valid suggestions could not be obtained.
   */
  const getNextHighlightSuggestion = useCallback(async (passage: Passage, searchStartIndex: number): Promise<HighlightSuggestion | null> => {
    let attempt = 0;
    let clarificationMessage = "";

    while (attempt < MAX_RETRY_ATTEMPTS) {
      try {
        const { precedingText, searchArea } = getContextForHighlightSuggestions(
          passage,
          passages,
          searchStartIndex,
          1000
        );

        const response = await callOpenAIStateless(
          apiKey,
          constructSystemPrompt(passage, precedingText, searchArea) + clarificationMessage,
          OPENAI_MODEL
        );

        // Validate response format
        const parsedResponse = JSON.parse(response.output_text.trim());
        if (
          !parsedResponse ||
          typeof parsedResponse !== "object" ||
          Object.keys(parsedResponse).length !== 2 ||
          typeof parsedResponse.passage !== "string" ||
          !Array.isArray(parsedResponse.codes) ||
          !searchArea.includes(parsedResponse.passage) ||
          parsedResponse.codes.some((code: string) => code.includes(";"))
        ) {
          throw new Error("InvalidResponseFormatError: Response does not match the required format. Received response:" + response.output_text.trim());
        }

        // Find the start index of the suggested passage within the passage text
        const startIdx = searchStartIndex + passage.text.slice(searchStartIndex).indexOf(parsedResponse.passage);

        // Success (no error caught) - return the suggestion
        return {passage: parsedResponse.passage, startIndex: startIdx, codes: parsedResponse.codes};
      } catch (error) {
        // Parsing failed, retry with a clarifying message
        clarificationMessage = `
          \n## IMPORTANT NOTE!
          Previous attempt caused the following error. Please ensure it does not happen again.
          ERROR MESSAGE: ${error instanceof Error ? error.message : ""}
        `;
        console.warn(
          `Highlight suggestion attempt ${attempt + 1} for ${passage.text.slice(0, 25)} failed with error: ${error instanceof Error ? error.message : ""}. Retrying...`
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

    console.warn(`All attempts to fetch AI highlight suggestions for passage "${passage.text.slice(0, 25)}" failed. Returning no suggestions...`);
    return null; // Return null if all attempts fail
  }, [apiKey, passages, researchQuestions, contextInfo, codebook, codes]);

  return {
    getNextHighlightSuggestion,
  };
};

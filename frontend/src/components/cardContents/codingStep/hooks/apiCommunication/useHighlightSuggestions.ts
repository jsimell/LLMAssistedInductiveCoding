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
  } = context;


  /** Constructs the system prompt for the AI based on the current context.
   *
   * @param passage The passage for which to get the highlight suggestion.
   * @param precedingText The text preceding the main text in the context window.
   * @param mainText The main text in the context window where the AI should search for highlights.
   * @returns A string prompt for the AI.
   */
  const constructSystemPrompt = (passage: Passage, precedingText: string, mainText: string) => {
    return `
      ## ROLE:
      You are an expert qualitative analyst AI assistant. 
      Your primary task is to identify and code the next relevant passage from the provided context window.

      ## APPROACH:
      1. Carefully review the context information found under CONTEXT INFORMATION.
      2. Read the MAIN TEXT (text between <<START OF MAIN TEXT>> and <<END OF MAIN TEXT>>) from the top down to find the FIRST subpassage offering meaningful insight related to the research questions.
      - The selection style (length, cropping, detail) should mimic the few-shot examples, if they exist.
      - It is important that you identify the FIRST relevant passage, not necessarily the most relevant one.
      3. Suggest ONE initial code that best represents the identified subpassage in relation to the research questions.
      - Use a code from the codebook when possible.
      - Create a new code if the passage covers a concept not present in the codebook, ensuring consistency with codebook style and abstraction.
      4. Return the identified passage and code as specified.
      5. If no relevant passage is found, respond with empty strings for both passage and codeSuggestion.

      After each analysis, validate that the selected passage is an exact, 
      case-sensitive substring of the text between <<START OF MAIN TEXT>> and <<END OF MAIN TEXT>> and that the code precisely matches the codebook style. 
      Only proceed if these criteria are met; otherwise, self-correct before responding.

      ## RESPONSE FORMAT:
      Return ONLY a valid JavaScript object in the following format:
      {
      "passage": "exact, case-sensitive substring from the context window",
      "codeSuggestion": "suggested code"
      }
      Guidelines:
      - Do NOT include explanations or text outside the returned object.
      - Do not indicate truncation in any way (e.g. "..." in the passage). The passage must be exact.
      - The suggested code MUST NOT include semicolons (;). If punctuation is needed, use a different delimiter.
      - Start the code with a lowercase letter unless it is a proper noun. However, if codebook consistently uses uppercase, follow that style.
      - The passage must be an exact, case-sensitive substring of the context window, including whitespace and punctuation.
      
      Example: coding a passage:
      {
      "passage": "Relevant passage from the context window.",
      "codeSuggestion": "A code from the codebook or a new code"
      }

      Example: if no relevant passage is found:
      {
      "passage": "",
      "codeSuggestion": ""
      }

      ## CONTEXT INFORMATION:
      **Research questions:** ${researchQuestions}
      **Additional context information:** ${contextInfo ?? "No additional context provided."}
      **Codebook:** [${Array.from(codebook).map((code) => `${code}`).join(", ")} ?? "No codes yet."]
      **Few-shot examples of user coded passages:** [
        ${constructFewShotExamplesString(passage, passages, codes)}
      ]

      ## CONTEXT WINDOW:
      ${precedingText.trim().length > 0 ?
        `### PRECEDING TEXT (for understanding only):
        <<START OF PRECEDING TEXT>>
        ${precedingText}
        <<END OF PRECEDING TEXT>>` : ""}
      ### MAIN TEXT (your highlight search area):
      <<START OF MAIN TEXT>>
      ${mainText}
      <<END OF MAIN TEXT>>
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
        const { precedingText, mainText } = getContextForHighlightSuggestions(
          passage,
          passages,
          searchStartIndex,
        );

        const response = await callOpenAIStateless(
          apiKey,
          constructSystemPrompt(passage, precedingText, mainText) + clarificationMessage,
          OPENAI_MODEL
        );

        // Validate response format
        const parsedResponse = JSON.parse(response.output_text.trim());
        if (
          !parsedResponse ||
          typeof parsedResponse !== "object" ||
          Object.keys(parsedResponse).length !== 2 ||
          typeof parsedResponse.passage !== "string" ||
          typeof parsedResponse.codeSuggestion !== "string" ||
          !mainText.includes(parsedResponse.passage) ||
          parsedResponse.codeSuggestion.includes(";")
        ) {
          throw new Error("InvalidResponseFormatError: Response does not match the required format. Received response:" + response.output_text.trim());
        }

        // Success (no error caught) - return the suggestion
        return {passage: parsedResponse.passage, code: parsedResponse.codeSuggestion};
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

import { useContext, useEffect, useState } from "react";
import { WorkflowContext } from "../../../../context/WorkflowContext";
import { initializeConversation, callOpenAI } from "../../../../services/openai";
import OpenAI from "openai";

const MAX_RETRY_ATTEMPTS = 3;
const CONVERSATION_KEY = "full-coding"; // Add this constant
const OPENAI_MODEL = "gpt-4o-mini"; // Define the model to use

interface CodedPassage {
  passage: string;
  codes: string[];
}

export const useFullSuggestions = () => {
  // Get global states from the context
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useFullSuggestions must be used within a WorkflowProvider");
  }
  const { rawData, researchQuestions, contextInfo, passages, codes, codebook, apiKey } = context;

  // Local states
  const [latestSuggestions, setLatestSuggestions] = useState<CodedPassage[] | null>(null);  // Currently active suggestions
  const [isLoading, setIsLoading] = useState(false);

  // Reset suggestions and re-initialize the OpenAI conversation when context changes
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await initializeConversation(apiKey, constructSystemPrompt(), CONVERSATION_KEY);
        if (cancelled) return;
      } catch (err) {
        if (!cancelled) console.error("OpenAI initialization failed:", err);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [apiKey, rawData, researchQuestions, contextInfo]);


  /**
   * Constructs the system prompt (role: developer) for the AI suggestions based on the current context.
   * This prompt is sent only once per conversation, when the OpenAI instance is initialized.
   * Should be called again when research questions or context info change, to re-initialize the conversation.
   * 
   * @returns A string prompt for the AI.
   */
  const constructSystemPrompt = () => {
    return `
      ## ROLE:
      You are an expert qualitative coding assistant. Your task is to finish the coding of the following dataset by suggesting codes for passages that have NOT yet been coded.
    
      ---BEGIN DATA---
      ${rawData}
      ---END DATA---

      ## PRIORITY ORDER:
      1. Always obey the RESPONSE FORMAT.
      2. Follow BEHAVIOR RULES.
      3. Use CONTEXT (especially research questions) to decide relevance and guide code selection.

      ## BEHAVIOR RULES:
      ### How should you code the dataset?
      - You will receive user messages containing the current coding state: all passages that have already been coded and the full codebook.
      - Your task is to identify ALL the remaining RELEVANT and UNCODED passages from the dataset and suggest codes for them.
      - You must mimic the user's coding style and terminology when suggesting new codes.
      - You must infer which passages are uncoded by comparing the dataset with the passages in the current coding state.
      - Your coding decisions must be steered by the current coding state, research questions, your previous suggestions, and possible additional context information.
      - Treat the current coding state as your fixed and authoritative starting point for the coding; build your suggestions on top of it.
      - In other words, your suggestions should form a complete and internally consistent coding of the dataset, if added to the current coding state.
      - In your response, you must never:
        1. Include passages with no codes assigned.
        2. Include passages that are not relevant to the research questions.
        3. Include passages that have already been coded by the user.
      - Only use passages that exactly match the original text (verbatim, including spaces and punctuation).
      - If a passage occurs multiple times in the dataset, code all occurrences the same way, unless surrounding context suggests otherwise.
      - If there are clearly no relevant passages left to code, respond with an empty array [].
      ### How should you select passages and codes?
      - Focus on passages that are relevant to the research questions.
      - For each relevant uncoded passage, suggest 1-5 codes that best fit it.
      - Reuse existing codes from the codebook whenever possible; introduce new ones only if conceptually distinct.
      ### How should your responses relate to your previous suggestions?
      - Preserve your previously suggested passages and codes (if there are any) unless they conflict with the latest user updates or new codes.
      - For example, if the user has added new codes or modified existing ones, update your suggestions accordingly while keeping the rest intact.
      ### Additional guidelines: 
      - Maintain the natural order of passages from the dataset.

      ## RESPONSE FORMAT:
      Output a pure JSON array of objects. Each object must have:
      1. "passage": exact substring from the dataset.
      2. "codes": array of code suggestions for the passage.

      Example:
      [
        {"passage": "first relevant uncoded passage here", "codes": ["new code 1", "new code 2"]},
        {"passage": "second relevant uncoded passage here", "codes": ["code from the codebook", "another code from the codebook"]},
        {"passage": "third relevant uncoded passage here", "codes": ["code from the codebook", "new code 3"]},
      ]

      - Output must be valid JSON (no Markdown formatting, no text outside the array).
      - Never include explanations, reasoning, or commentary.

      ## CONTEXT:
      Research questions: ${researchQuestions}
      Additional context information: ${contextInfo}
      `;
  };


  /**
   * Constructs the prompt (role: user) for the next AI suggestion based on the current context.
   *
   * @returns A string prompt for the AI.
   */
  const constructUserPrompt = () => {
    // Create few-shot examples from existing passages and codes
    const codingState = passages.filter(p => p.codeIds.length > 0).map((p) => ({
      passage: p.text,
      codes: p.codeIds.map((id) => codes.find((c) => c.id === id)?.code).filter(Boolean),
    }));

    return `
        CURRENT CODEBOOK:
        ${Array.from(codebook).map((code) => `- ${code}`).join("\n")}

        CODING STATE:
        ${codingState.map((ex) => JSON.stringify(ex)).join(",\n")}
        `;
  };


  const fuzzyMatchSuggestions = (suggestions: CodedPassage[]): CodedPassage[] => {
    // TODO: Implement logic
    // - the function should compare each suggested passage with existing passages in the context
    // - if a suggested passage is very similar to an existing passage (e.g., Levenshtein distance below a threshold), consider it a match
    // - if a passage does not match any existing passage, it should be removed from the suggestions
    return suggestions;
  };


  /**
   * Converts the OpenAI response into an array of AiSuggestion objects.
   *
   * @param response - The OpenAI response object.
   * @returns An array of AiSuggestion objects.
   * @throws Error if the response format is invalid or contains no valid suggestions.
   */
  const parseAiResponse = (response: OpenAI.Responses.Response): CodedPassage[] => {
    const text = response.output_text.trim();
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]") + 1;

    if (start === -1 || end === -1) {
      throw new Error("INVALID_FORMAT: No JSON array found in response");
    }

    const jsonPart = text.slice(start, end);
    let codedPassages: CodedPassage[];
    
    try {
      codedPassages = JSON.parse(jsonPart) as CodedPassage[];
    } catch {
      throw new Error("INVALID_JSON: Response contained malformed JSON");
    }

    // Check that each object has the required structure
    codedPassages.forEach(cp => {
      if (
        !["passage","codes"].every(k => k in cp) ||
        Object.keys(cp).length !== 2 ||
        typeof cp.passage !== "string" ||
        !Array.isArray(cp.codes) ||
        !cp.codes.every(c => typeof c === "string")
      ) throw new Error("INVALID_JSON_STRUCTURE: Response array contained improperly structured objects.");
    });
    
    // Filter out passages with empty codes array
    const filtered = codedPassages.filter(s => s.codes.length > 0);
    
    if (filtered.length === 0) {
      throw new Error("EMPTY_RESULT: No valid code suggestions found");
    }
    
    return filtered;
  };


  /**
   * Updates the AI suggestions with automatic retry on recoverable errors.
   * Retries up to MAX_RETRY_ATTEMPTS times with clarifying messages when parsing fails.
   * 
   * @throws Error if all retry attempts fail or a fatal error occurs.
   */
  const updateSuggestions = async () => {
    setIsLoading(true);
    let attempt = 0;
    let previousError: Error | null = null;

    while (attempt < MAX_RETRY_ATTEMPTS) {
      try {
        let clarificationMessage: string | undefined;

        // Add clarification based on previous error
        if (previousError?.message.startsWith("INVALID_FORMAT")) {
          clarificationMessage = "Your previous response did not contain a valid JSON array. Please ensure your response is ONLY a JSON array with no additional text or markdown formatting.";
        } else if (previousError?.message.startsWith("INVALID_JSON")) {
          clarificationMessage = "Your previous response contained malformed JSON. Please ensure the JSON is properly formatted with correct syntax.";
        } else if (previousError?.message.startsWith("EMPTY_RESULT")) {
          clarificationMessage = "Your previous response contained no valid suggestions. If there are truly no more passages to code, return the existing coding state exactly as provided.";
        } else if (previousError?.message.startsWith("INVALID_JSON_STRUCTURE")) {
          clarificationMessage = "Your previous response contained improperly structured objects. Please ensure each object in the array has the correct structure: {'passage': '...', 'codes': ['code1', 'code2']}.";
        } else {
          clarificationMessage = "";
        }

        const codedPassages = await callOpenAI(
          apiKey, 
          constructSystemPrompt(), 
          clarificationMessage + constructUserPrompt(),
          CONVERSATION_KEY, // Add conversation key
          OPENAI_MODEL
        );
        const parsedSuggestions = parseAiResponse(codedPassages);

        // Success (no error caught) - update state and exit
        setLatestSuggestions(parsedSuggestions)
        setIsLoading(false);
        return;

      } catch (error) {
        previousError = error instanceof Error ? error : new Error(String(error));
        console.warn(`AI suggestion attempt ${attempt + 1} failed:`, previousError.message);
        attempt++;

        // If it's a network/API error (not a parsing error), don't retry
        if (!previousError.message.match(/^(INVALID_FORMAT|INVALID_JSON|INVALID_JSON_STRUCTURE|EMPTY_RESULT)/)) {
          break;
        }
      }
    }
  };

  return {
    latestSuggestions,
    isLoading,
    updateSuggestions,
  };
};

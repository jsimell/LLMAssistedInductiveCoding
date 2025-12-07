import { useContext } from "react";
import {
  Passage,
  WorkflowContext,
} from "../../../../../context/WorkflowContext";

export const usePrompts = () => {
  const context = useContext(
    WorkflowContext
  );
  if (!context) {
    throw new Error(
      "usePrompts must be used within a WorkflowProvider"
    );
  }

  const {
    researchQuestions,
    codingGuidelines,
    fewShotExamples,
    codebook,
    contextInfo,
    passages,
    codes,
  } = context;

  /**
   * Retrieves the prompt for highlight suggestions based on the uploaded data format. Uses the current context for dynamic generation.
   * @param precedingText Preceding text of the search area. For review, can be left undefined, in which case a placeholder will be used.
   * @param searchArea The text area in which to search for the next highlight suggestion. For review, can be left undefined, in which case a placeholder will be used.
   * @return The highlight suggestions prompt string, or null, if not all required information has been defined in the context
   */
  const generateHighlightSuggestionsPrompt =
    (
      dataIsCSV: boolean,
      precedingText?: string,
      searchArea?: string
    ) => {
      if (!dataIsCSV) {
        return `
## ROLE
You are an expert qualitative coding assistant whose purpose is to provide coding suggestions that mimic the coding style of the user. 
Your task is to analyze the SEARCH AREA, and identify and code the FIRST passage that is relevant to the research context.
You should use all provided context and examples as guidance. You must respond only with the specified format.

## RESEARCH CONTEXT
Research questions: ${researchQuestions}
${
  contextInfo
    ? `Additional research context: ${contextInfo}`
    : ""
}

## TASK
1) Review the codebook and examples to understand the user's coding style.
2) Below you will find your SEARCH AREA for the next passage to code. Find the FIRST subpassage that provides meaningful insight related to the research context.
  - IMPORTANT: always select the FIRST relevant passage in the SEARCH AREA, not necessarily the most relevant one.
  - Selection style (length, cropping, detail) should mimic the examples.
3) Assign 1-5 relevant codes:
  - Mimic the coding style (e.g., language, conciseness, level of abstraction, casing) of the examples.
  - Prefer codebook codes; create new codes only if needed, matching the user's coding style.
  - Cover all important aspects, but avoid overcoding.
4) If no relevant passage is found, return an empty string for "passage" and an empty array for "codes".
5) Validate that the selected passage is an exact, case-sensitive substring of the SEARCH AREA.
${
  codingGuidelines?.trim()
    .length > 0
    ? `\n## USER PROVIDED CODING GUIDELINES\n${codingGuidelines}\n`
    : ""
}
## USER'S CODING STYLE
Codebook: [${
  codebook.size > 0
    ? `${Array.from(codebook)
        .map((code) => `${code}`)
        .join(", ")}`
    : "No codes in the codebook yet"
}]
Few-shot examples of user coded passages (coded passage marked in context with <<< >>>): 
[
  ${
    fewShotExamples.length > 0
      ? fewShotExamples
          .map(
            (example) =>
              `{
        codedPassage: "${example.codedPassage
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
          .replace(
            /\t/g,
            "\\t"
          )}",
        codes: [${example.codes
          .map(
            (code) =>
              `"${code.replace(
                /"/g,
                '\\"'
              )}"`
          )
          .join(", ")}],
        context: "${example.context
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
          .replace(
            /\t/g,
            "\\t"
          )}",
      }`
          )
          .join(",\n")
      : "No few-shot examples specified yet"
  }
]

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
No explanations or extra text.
No truncation indicators (e.g. "...").
No JSON tags (\`\`\`json) or other markdown formatting.
Codes must NOT contain semicolons (;).
Start codes with lowercase unless codebook consistently uses uppercase.
If you suggest a passage, the codes array must never be empty.
Escape special characters in "passage" (e.g. double quotes as \\", newlines as \\n, tabs as \\t).

## CONTEXT WINDOW
${
  precedingText &&
  precedingText.trim().length > 0
    ? `
### PRECEDING TEXT (for understanding only)
"${precedingText}"
`
    : "<preceding text will be inserted here>"
}
### SEARCH AREA (choose your suggestion from here)
"${
  searchArea
    ? searchArea
    : "<search area will be inserted here>"
}"`;
      } else {
        return `
## ROLE
You are an expert qualitative coding assistant. Your task is to identify and code the next relevant passage from the SEARCH AREA, 
using all provided context and examples as guidance. The data is from a CSV file, where rows end with the token "\\u001E".

## RESEARCH CONTEXT
Research questions: ${researchQuestions}
${
  contextInfo
    ? `Additional research context: ${contextInfo}`
    : ""
}

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
${
  codingGuidelines?.trim()
    .length > 0
    ? `\n## USER PROVIDED CODING GUIDELINES\n${codingGuidelines}\n`
    : ""
}
## USER'S CODING STYLE
Codebook: [${
  codebook.size > 0
    ? `${Array.from(codebook)
        .map((code) => `${code}`)
        .join(", ")}`
    : "No codes in the codebook yet"
}]
Few-shot examples of user coded passages (coded passage marked in context with <<< >>>):
[
  ${
    fewShotExamples.length > 0
      ? fewShotExamples
          .map(
            (example) =>
              `{
        codedPassage: "${example.codedPassage
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
          .replace(
            /\t/g,
            "\\t"
          )}",
        codes: [${example.codes
          .map(
            (code) =>
              `"${code.replace(
                /"/g,
                '\\"'
              )}"`
          )
          .join(", ")}],
        context: "${example.context
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
          .replace(
            /\t/g,
            "\\t"
          )}",
      }`
          )
          .join(",\n")
      : "No few-shot examples specified yet"
  }
]

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
No explanations or extra text.
No truncation indicators (e.g. "...").
No JSON tags (\`\`\`json) or other markdown formatting.
Codes must NOT contain semicolons (;).
Start codes with lowercase unless codebook consistently uses uppercase.
The "passage" MUST be an exact, case-sensitive substring of the SEARCH AREA.
Escape special characters in "passage" (e.g. double quotes as \\", newlines as \\n, tabs as \\t).
Do not include the end of row token \\u001E in your response.

## CONTEXT WINDOW
${
  precedingText &&
  precedingText.trim().length > 0
    ? `
### PRECEDING TEXT (for understanding only)
"${precedingText}"
`
    : "<preceding text will be inserted here>"
}
### SEARCH AREA (choose your suggestion from here)
"${
  searchArea
    ? searchArea
    : "<search area will be inserted here>"
}"
`;
      }
    };

  /**
   * Generates the autocomplete suggestions prompt based on the uploaded data format. Uses the current context for dynamic generation.
   * @param dataIsCSV Boolean flag indicating whether the uploaded data is in CSV format
   * @param passage The passage to generate autocomplete suggestions for
   * @param passageWithSurroundingContext The passage along with its surrounding context to provide more information for generating suggestions
   * @returns The autocomplete suggestions prompt string
   */
  const generateAutocompleteSuggestionsPrompt =
    (
      dataIsCSV: boolean,
      passage?: Passage,
      passageWithSurroundingContext?: string
    ) => {
      const existingCodes = passage
        ? passage.codeIds
            .map(
              (cid) =>
                codes.find(
                  (c) => c.id === cid
                )?.code || ""
            )
            .filter(Boolean)
        : [];

      return `
## ROLE
You are a qualitative coding assistant for code autocompletion. Given a passage and its surrounding context, 
suggest a broad set of relevant codes to maximize autocomplete matches.

## RESEARCH CONTEXT
Research questions: ${researchQuestions}
${
  contextInfo
    ? `Additional research context: ${contextInfo}`
    : ""
}

## TASK
1. Think of 3-6 core codes, each conceptually distinct from existing codes.
2. For each core code, provide 3-6 alternative phrasings.
  - This adds up to total suggestions being 9-36 codes.
  - Ensure all codes are relevant to the research questions and context.
  - Do NOT include any codes from the codebook or the passage's existing codes.
  - Use the user's coding style for wording and format.
${
  codingGuidelines?.trim()
    .length > 0
    ? `\n## USER PROVIDED CODING GUIDELINES\n${codingGuidelines}\n`
    : ""
}
## USER'S CODING STYLE
Codebook: [${
  codebook.size > 0
    ? `${Array.from(codebook)
        .map((code) => `${code}`)
        .join(", ")}`
    : "No codes in the codebook yet"
}]
Few-shot examples of user coded passages (coded passage marked in context with <<< >>>):
[
  ${
    fewShotExamples.length > 0
      ? fewShotExamples
          .map(
            (example) =>
              `{
        codedPassage: "${example.codedPassage
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
          .replace(
            /\t/g,
            "\\t"
          )}",
        codes: [${example.codes
          .map(
            (code) =>
              `"${code.replace(
                /"/g,
                '\\"'
              )}"`
          )
          .join(", ")}],
        context: "${example.context
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
          .replace(
            /\t/g,
            "\\t"
          )}",
      }`
          )
          .join(",\n")
      : "No few-shot examples specified yet"
  }
]

## TARGET PASSAGE
Passage to code: "${
  passage
    ? passage.text
    : "<passage to code will be inserted here>"
}"
Existing codes: ${
  passage
    ? existingCodes.length > 0
      ? `[${existingCodes.join(
          ", "
        )}]`
      : "None"
    : "<existing codes of the passage to code will be inserted here>"
}

## RESPONSE FORMAT
Respond ONLY with a JSON array of code strings, e.g. ["code1", "code2", "code3"]. 
No explanations. No JSON tags (\`\`\`json) or other markdown formatting. Codes must never contain semicolons (;).

## CONTEXT WINDOW
The target passage appears in the context window between "<<<" and ">>>".
${
  dataIsCSV
    ? `The data is from a CSV file, where rows end with the token "\u001E".`
    : ""
}
<START OF CONTEXT WINDOW>
"${
  passageWithSurroundingContext
    ? passageWithSurroundingContext
    : "<target passage with surrounding context will be inserted here>"
}"
<END OF CONTEXT WINDOW>
`;
    };

  /**
   * Generates the code suggestions prompt based on the uploaded data format. Uses the current context for dynamic generation.
   * @param dataIsCSV Boolean flag indicating whether the uploaded data is in CSV format
   * @param passage The passage to generate code suggestions for
   * @param passageWithSurroundingContext The passage along with its surrounding context to provide more information for generating suggestions
   * @returns The code suggestions prompt string
   */
  const generateCodeSuggestionsPrompt =
    (
      dataIsCSV: boolean,
      passage?: Passage,
      passageWithSurroundingContext?: string
    ) => {
      const existingCodes = passage
        ? passage.codeIds
            .map(
              (cid) =>
                codes.find(
                  (c) => c.id === cid
                )?.code || ""
            )
            .filter(Boolean)
        : [];

      return `
## ROLE
You are a qualitative coding assistant. Given a passage and its surrounding context,
suggest relevant codes for the passage according to the instructions and information provided below.

## RESEARCH CONTEXT
Research questions: ${researchQuestions}
${
  contextInfo
    ? `Additional research context: ${contextInfo}`
    : ""
}

## TASK
Case 1 - If the passage has NO existing codes: 
  - Provide a comprehensive coding for the passage. Suggest max 5 conceptually distinct codes that capture what the passage reveals in relation to the research questions.
Case 2 - If the passage has existing codes:
  - Suggest additional codes that complement existing ones and provide additional insights. Do not repeat or closely match existing codes. Total codes (existing + new) should be max 5.
In both cases:
  - Only suggest codes that provide meaningful value in terms of the research questions.
  - Reuse codebook codes if possible. Only create new codes if needed. Ensure new codes match the user's coding style. 
  - Cover ALL relevant aspects, but avoid overcoding. If you can't think of any relevant codes, return [].
  - Do NOT include any of the passage's existing codes in your suggestions.
${
  codingGuidelines?.trim()
    .length > 0
    ? `\n## USER PROVIDED CODING GUIDELINES\n${codingGuidelines}\n`
    : ""
}
## USER'S CODING STYLE
Codebook: [${
  codebook.size > 0
    ? `${Array.from(codebook)
        .map((code) => `${code}`)
        .join(", ")}`
    : "No codes in the codebook yet"
}]
Few-shot examples of user coded passages (coded passage marked in context with <<< >>>):
[
  ${
    fewShotExamples.length > 0
      ? fewShotExamples
          .map(
            (example) =>
              `{
        codedPassage: "${example.codedPassage
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
          .replace(
            /\t/g,
            "\\t"
          )}",
        codes: [${example.codes
          .map(
            (code) =>
              `"${code.replace(
                /"/g,
                '\\"'
              )}"`
          )
          .join(", ")}],
        context: "${example.context
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
          .replace(
            /\t/g,
            "\\t"
          )}",
      }`
          )
          .join(",\n")
      : "No few-shot examples specified yet"
  }
]

## TARGET PASSAGE
Passage to code: "${
  passage
    ? passage.text
    : "<passage to code will be inserted here>"
}"
Existing codes: ${
  passage
    ? existingCodes.length > 0
      ? `[${existingCodes.join(
          ", "
        )}]`
      : "None"
    : "<existing codes of the passage to code will be inserted here>"
}

## RESPONSE FORMAT
Respond ONLY with a JSON array of code strings, e.g. ["code1", "code2", "code3"]. 
No explanations. No JSON tags (\`\`\`json) or other markdown formatting. Codes must never contain semicolons (;).

## CONTEXT WINDOW
The target passage appears in the context window between "<<<" and ">>>".
${
  dataIsCSV
    ? `The data is from a CSV file, where rows end with the token "\\u001E".`
    : ""
}
<START OF CONTEXT WINDOW>
"${
  passageWithSurroundingContext
    ? passageWithSurroundingContext
    : "<target passage with surrounding context will be inserted here>"
}"
<END OF CONTEXT WINDOW>
`;
    };

  return {
    generateHighlightSuggestionsPrompt,
    generateAutocompleteSuggestionsPrompt,
    generateCodeSuggestionsPrompt,
  };
};

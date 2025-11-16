import { Code, Passage } from "../../../../context/WorkflowContext";

/**
 * Goes through a string from the start to end and tries to find a suitable cut point within 200 characters.
 * @param text text to cut
 * @returns the text cut at a suitable point
 */
const cutTextFromEnd = (text: string) => {
  const maxRange = 200;

  // 1) Try to cut at a line break within the text length, and within maxRange
  let i = 0;
  while (i < maxRange && i < text.length) {
    const char = text[i];
    if (char === "\n") {
      return text.slice(0, i + 1);
    }
    i++;
  }

  // 2) Try to cut at a sentence end within maxRange from the start
  const indices = [".", "!", "?"]
    .map((punct) => text.indexOf(punct))
    .filter((idx) => idx !== -1 && idx <= maxRange);
  const endIdx = indices.length ? Math.min(...indices) : -1;
  if (endIdx !== -1) {
    return text.slice(0, endIdx + 1);
  } else {
    // 3) No good cut point found, cut at maxRange and include "..." to indicate truncation
    return text.slice(0, maxRange) + "...";
  }
};

/**
 * Goes through a string from the end to start and tries to find a suitable cut point within 200 characters.
 * @param text the text to cut
 * @returns the text cut at a suitable point
 */
export const cutTextFromStart = (text: string) => {
  const maxRange = 200;

  // 1) Try to cut at a line break within the text length and maxRange
  let i = text.length - 1;
  while (i > text.length - 1 - maxRange && i >= 0) {
    const char = text[i];
    if (char === "\n") {
      return text.slice(i + 1, text.length);
    }
    i--;
  }

  // 2) Try to cut at a sentence end within maxRange from the end
  const searchStart = Math.max(0, text.length - maxRange);
  const indices = [".", "!", "?"]
    .map((punct) => text.lastIndexOf(punct, text.length))
    .filter((idx) => idx !== -1 && idx >= searchStart);
  const endIdx = indices.length ? Math.max(...indices) : -1;
  if (endIdx !== -1) {
    return text.slice(endIdx + 1, text.length);
  } else {
    // 3) No good cut point found, cut at maxRange and include "..." to indicate truncation
    return "..." + text.slice(text.length - maxRange, text.length);
  }
};

/**
 * Gets the passage with surrounding context. Context is cut intelligently to avoid breaking sentences or lines.
 * Truncation appears within 200 characters at both the start and end of the context.
 * @param passage The passage object for which to get the surrounding context
 * @param passages All passages in the document
 * @param contextWindowSize Number of characters to include before and after the passage
 * @returns A text window that contains the passage and its surrounding context
 */
export const getPassageWithSurroundingContext = (
  passage: Passage,
  passages: Passage[],
  contextWindowSize: number = 500
): string => {
  const passageOrder = passage.order;
  let precedingText = "";
  let followingText = "";

  const contextSize = contextWindowSize ?? 500;

  // COLLECT PRECEDING PASSAGES //
  for (let i = passageOrder - 1; i >= 0; i--) {
    const p = passages.find((p) => p.order === i);
    if (!p) break;

    // Add entire p.text if within context limit
    if (precedingText.length + p.text.length <= contextSize / 2 - 30) {
      precedingText = p.text + precedingText;
      continue;
    }

    // p.text would exceed context limit, cut it intelligently
    precedingText = cutTextFromStart(p.text) + precedingText;
    break; // Stop after finding a cut point
  }

  // COLLECT FOLLOWING PASSAGES //
  for (let j = passageOrder + 1; j < passages.length; j++) {
    const p = passages.find((p) => p.order === j);
    if (!p) break;

    // Add text if within context limit
    if (followingText.length + p.text.length <= contextSize / 2 - 30) {
      followingText += p.text;
      continue;
    }

    // p.text would exceed context limit, cut it intelligently
    followingText += cutTextFromEnd(p.text);
    break; // Stop after finding a cut point
  }

  return `${precedingText}<<<${passage.text}>>>${followingText}`;
};


/**
 * Gets a ~1000 character context for highlight suggestions starting from a given passage. 
 * Cuts preceding and following text within 200 characters at a suitable point using cutPassageFromStart and cutPassageFromEnd.
 * @param startPassage The first passage from which the LLM will search for highlightsuggestions
 * @param passages current passages
 * @returns an object containing precedingText (for llm understanding) and mainText (the text to search for highlights)
 */
export const getContextForHighlightSuggestions = (
  startPassage: Passage,
  passages: Passage[],
  searchStartIndex: number,
): { precedingText: string; mainText: string } => {
  // If there's only one passage, return its text split at searchStartIndex
  if (passages.length === 1) {
    return { precedingText: passages[0].text.slice(0, searchStartIndex), mainText: passages[0].text.slice(searchStartIndex) };
  }
  
  const beforeStartIdx = passages[0].text.slice(0, searchStartIndex);
  const afterStartIdx = passages[0].text.slice(searchStartIndex);
  const passageOrder = startPassage.order;
  const precedingPassage = passages.find((p) => p.order === passageOrder - 1);

  // Get preceding text
  const precedingText = precedingPassage
    ? cutTextFromStart(precedingPassage.text) + beforeStartIdx
    : beforeStartIdx;
  
  // Get main text
  const maxMainTextLength = 800; // Using 800 instead of 1000, because text cutting requires some buffer
  
  // If entire afterStartIdx fits within limit, return it
  if (afterStartIdx.length <= maxMainTextLength) {
    return {precedingText, mainText: afterStartIdx};
  }

  let mainText = afterStartIdx.slice(0, maxMainTextLength);
  // After 800, characters, look for a suitable cut point in remaining text
  mainText += cutTextFromEnd(afterStartIdx.slice(mainText.length));

  return {precedingText, mainText}
};

/** Constructs few-shot examples string for the system prompt based on existing coded passages.
 *
 * @returns The few-shot examples
 */
export const constructFewShotExamplesString = (passage: Passage, passages: Passage[], codes: Code[]) => {
  const codedPassages = passages.filter((p) => p.id !== passage.id && p.codeIds.length > 0);
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
        surroundingContext: getPassageWithSurroundingContext(p, passages, 1), // Use 1 to cut at the first suitable break point before and after the passage
        codes: codes_
      });
    })
    .join(",\n");

  return fewShotExamples
};

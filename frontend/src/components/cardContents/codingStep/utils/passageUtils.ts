import { Code, Passage } from "../../../../context/WorkflowContext";

/**
 * Includes text from the end up to minimumLength, then looks for a suitable cut point within the previous cutWindowSize characters.
 * @param text text to cut
 * @param minimumLength the number of characters after which to start looking for a cut point
 * @param cutWindowSize the maximum number of characters to look for a cut point
 * @returns the text cut at a suitable point
 */
export const getPrecedingContext = (text: string, minimumLength: number, cutWindowSize: number) => {
  // If text is already short enough, return it as is
  if (text.length <= minimumLength) {
    return text;
  }

  // First, take the minimumLength part
  let includedText = text.slice(text.length - minimumLength);

  // Then, look for a suitable cut point in the preceding cutWindowSize characters
  const cutWindow = text.slice(text.length - minimumLength - cutWindowSize, text.length - minimumLength);
  
  // If cut window is shorter than cutWindowSize ->  entire text fits in minimumLength + cutWindowSize
  if (cutWindow.length < cutWindowSize) {
    includedText = includedText + cutWindow;
    return includedText;
  }

  // Look for a line break to cut at
  const lineBreakIdx = cutWindow.lastIndexOf("\n");
  if (lineBreakIdx !== -1) {
    includedText = cutWindow.slice(lineBreakIdx + 1) + includedText;
    return includedText;
  }

  // Next, look for sentence ending punctuation
  const sentenceEndIdx = Math.max(
    cutWindow.lastIndexOf(". "),
    cutWindow.lastIndexOf("! "),
    cutWindow.lastIndexOf("? ")
  );
  if (sentenceEndIdx !== -1) {
    includedText = cutWindow.slice(sentenceEndIdx + 1) + includedText;
    return includedText;
  }

  // If no suitable cut point found, simply cut after minimumLength has been included
  includedText = "..." + includedText;  // Indicate truncation with "..."
  return includedText;
};

/**
 * Includes text from the start up to minimumLength, then looks for a suitable cut point within the next cutSearchArea characters.
 * @param text the text to cut
 * @param minimumLength the number of characters to include at minimum
 * @param cutSearchArea the number of characters after minimumLength to look for a suitable cut point
 * @returns the text cut at a suitable point
 */
export const getTrailingContext = (text: string, minimumLength: number, cutWindowSize: number) => {
  // If text is already short enough, return it as is
  if (text.length <= minimumLength) {
    return text;
  }

  // First, take the minimumLength part
  let includedText = text.slice(0, minimumLength);

  // Then, look for a suitable cut point in the next cutSearchArea characters
  const cutWindow = text.slice(minimumLength, minimumLength + cutWindowSize);

  // If cut window is shorter than cutWindowSize ->  entire text fits in minimumLength + cutWindowSize
  if (cutWindow.length < cutWindowSize) {
    includedText = includedText + cutWindow;
    return includedText;
  }

  // Look for a line break to cut at
  const lineBreakIdx = cutWindow.indexOf("\n");
  if (lineBreakIdx !== -1) {
    includedText = includedText + cutWindow.slice(lineBreakIdx + 1);
    return includedText;
  }

  // Look for sentence ending punctuation
  const sentenceEndIdx = Math.min(
    cutWindow.indexOf(". "),
    cutWindow.indexOf("! "),
    cutWindow.indexOf("? ")
  );
  if (sentenceEndIdx !== -1) {
    includedText = includedText + cutWindow.slice(0, sentenceEndIdx + 1);
    return includedText;
  }

  // Fallback: If no suitable cut point found, simply cut directly after minimumLength has been included
  includedText = includedText + "...";  // Indicate truncation with "..."
  return includedText;
};

/**
 * Gets the passage with surrounding context. Context is cut intelligently to avoid breaking sentences or lines.
 * Truncation appears within 200 characters at both the start and end of the contextWindow.
 * @param passage The passage object for which to get the surrounding context
 * @param passages All passages in the document
 * @param minContextWindowSize Minimum number of additional characters to include in the context window in addition to the passage text.
 * Gets divided to before and after the passage text. If context window is 0, the function cuts at the suitable cut point occurring after contextWindow.
 * @param markPassageInResult Whether to mark the passage text in the result with <<< >>> (default: true)
 * @returns A text window that contains the passage and its surrounding context
 */
export const getPassageWithSurroundingContext = (
  passage: Passage,
  passages: Passage[],
  minContextWindowSize: number,
  markPassageInResult: boolean,
): string => {
  const passageOrder = passage.order;
  let precedingText = passages.filter((p) => p.order < passageOrder).map((p) => p.text).join("");
  let trailingText = passages.filter((p) => p.order > passageOrder).map((p) => p.text).join("");

  precedingText = getPrecedingContext(precedingText, minContextWindowSize / 2, 200);
  trailingText = getTrailingContext(trailingText, minContextWindowSize / 2, 200);

  if (markPassageInResult) {
    return `${precedingText}<<<${passage.text}>>>${trailingText}`;
  } else {
    return `${precedingText}${passage.text}${trailingText}`;
  }
};


/**
 * Gets a ~1000 character context for highlight suggestions starting from a given passage. 
 * Cuts preceding and following text within 200 characters at a suitable point using cutPassageFromStart and cutPassageFromEnd.
 * @param startPassage The first passage from which the LLM will search for highlightsuggestions
 * @param passages current passages
 * @param searchStartIndex The index in the startPassage text from which to start searching for highlights
 * @param minContextWindowSize The total MINIMUM size of the context window to return (default: 1000)
 * @returns an object containing precedingText (for llm understanding, may contain text from preceding passage),
 * and mainText (the text to search for highlights, is from startPassage in its entirety)
 */
export const getContextForHighlightSuggestions = (
  startPassage: Passage,
  passages: Passage[],
  searchStartIndex: number,
  minContextWindowSize: number
): { precedingText: string; searchArea: string } => {
  // If there's only one passage, return its text split at searchStartIndex
  if (passages.length === 1) {
    return { precedingText: passages[0].text.slice(0, searchStartIndex), searchArea: passages[0].text.slice(searchStartIndex) };
  }
  
  const passageOrder = startPassage.order;

  // Construct uncut preceding text
  let precedingText = 
    passages.filter((p) => p.order < passageOrder).map((p) => p.text).join("") + 
    startPassage.text.slice(0, searchStartIndex);

  // Construct uncut search area text
  let searchArea = 
    startPassage.text.slice(searchStartIndex) + 
    passages.filter((p) => p.order > passageOrder).map((p) => p.text).join("");

  const precedingSize = Math.floor(minContextWindowSize / 5);  // max 20% of context window for preceding text
  const searchAreaSize = minContextWindowSize - precedingSize;  // remaining context window for search area

  // If preceding text is already short enough, only cut search area
  if (precedingText.trim().length <= precedingSize) {
    return {precedingText: precedingText.trim(), searchArea: getTrailingContext(searchArea, searchAreaSize, 200)};
  }

  // Cut preceding text to suitable length
  precedingText = getPrecedingContext(precedingText, precedingSize, 200);
  // Cut search area to suitable length
  searchArea = getTrailingContext(searchArea, searchAreaSize, 200);

  return {precedingText, searchArea}
};

/** Constructs few-shot examples string for the system prompt based on existing coded passages.
 *
 * @returns The few-shot examples, or a message indicating no coded passages exist.
 */
export const constructFewShotExamplesString = (passage: Passage, passages: Passage[], codes: Code[]) => {
  const codedPassages = passages.filter((p) => p.id !== passage.id && p.codeIds.length > 0);
  if (codedPassages.length === 0) {
    return "No user coded passages yet. Code as a professional qualitative analyst would.";
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
        surroundingContext: getPassageWithSurroundingContext(p, passages, 100, false),
        codes: codes_
      }, null, 2);
    })
    .join(",\n");

  return fewShotExamples
};

import { Code, Passage } from "../../../../context/WorkflowContext";

/**
 * Returns a tail slice of text. First includes text up to minimumLength, then looks for a suitable cut point within the preceding cutWindowSize characters.
 * @param text text to cut
 * @param minimumLength the number of characters after which to start looking for a cut point
 * @param cutWindowSize the maximum number of characters to look for a cut point
 * @returns the text cut at a suitable point
 */
export const getPrecedingContext = (
  text: string,
  minimumLength: number,
  cutWindowSize: number
) => {
  // If text is already short enough, return it as is
  if (text.length <= minimumLength) {
    return text;
  }

  // First, take the minimumLength part
  let includedText = text.slice(text.length - minimumLength);

  // Then, look for a suitable cut point in the preceding cutWindowSize characters
  const cutWindow = text.slice(
    Math.max(text.length - minimumLength - cutWindowSize, 0),
    text.length - minimumLength
  );

  // If cut window is shorter than cutWindowSize ->  entire text fits in minimumLength + cutWindowSize
  if (cutWindow.length < cutWindowSize) {
    includedText = cutWindow + includedText;
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
    cutWindow.lastIndexOf("."),
    cutWindow.lastIndexOf("!"),
    cutWindow.lastIndexOf("?")
  );
  if (sentenceEndIdx !== -1) {
    includedText = cutWindow.slice(sentenceEndIdx + 1) + includedText;
    return includedText;
  }

  // If no suitable cut point found, simply cut after minimumLength has been included
  includedText = "..." + includedText; // Indicate truncation with "..."
  return includedText;
};

/**
 * Returns a head slice of text. First, includes text up to minimumLength, then looks for a suitable cut point within the next cutSearchArea characters.
 * @param text the text to cut
 * @param minimumLength the number of characters to include at minimum
 * @param cutSearchArea the number of characters after minimumLength to look for a suitable cut point
 * @returns the text cut at a suitable point
 */
export const getTrailingContext = (
  text: string,
  minimumLength: number,
  cutWindowSize: number
) => {
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
    includedText = includedText + cutWindow.slice(0, lineBreakIdx + 1);
    return includedText;
  }

  // Look for sentence ending punctuation (pick earliest non-negative index)
  const candidates = [
    cutWindow.indexOf("."),
    cutWindow.indexOf("!"),
    cutWindow.indexOf("?"),
  ].filter((i) => i !== -1);
  const sentenceEndIdx = candidates.length ? Math.min(...candidates) : -1;

  if (sentenceEndIdx !== -1) {
    includedText = includedText + cutWindow.slice(0, sentenceEndIdx + 1);
    return includedText;
  }

  // Fallback: If no suitable cut point found, simply cut directly after minimumLength has been included
  includedText = includedText + "..."; // Indicate truncation with "..."
  return includedText;
};

/**
 * Returns the preceding text that occurs before the parameter passage in the CSV row it belongs to.
 * @param passage The passage for which to get the preceding context
 * @param passages The current passages state
 * @returns a string containing the preceding text from the same CSV row
 */
export const getPrecedingContextFromCsvRow = (
  passage: Passage,
  passages: Passage[]
): string => {
  const precedingText = passages
    .filter((p) => p.order < passage.order)
    .map((p) => p.text)
    .join("");

  const lastIndexOfEOR = precedingText.lastIndexOf("\u001E");

  // If no end of row marker found, return preceding context normally
  if (lastIndexOfEOR === -1) {
    return getPrecedingContext(precedingText, 0, 500);
  }

  return precedingText.slice(lastIndexOfEOR + 1); // +1 to cut right after the "\u001E"
};

/**
 * Returns the trailing text that occurs after the parameter passage in the CSV row it belongs to.
 * @param passage The passage for which to get the trailing context
 * @param passages The current passages state
 * @returns a string containing the trailing text from the same CSV row
 */
export const getTrailingContextFromCsvRow = (
  passage: Passage,
  passages: Passage[]
): string => {
  const followingText = passages
    .filter((p) => p.order > passage.order)
    .map((p) => p.text)
    .join("");

  const firstIndexOfEOR = followingText.indexOf("\u001E");

  // If no end of row marker found, return trailing context normally
  if (firstIndexOfEOR === -1) {
    return getTrailingContext(followingText, 0, 500);
  }

  return followingText.slice(0, firstIndexOfEOR); // up to (not including) the "\u001E"
};



// PUBLIC API

/**
 * Returns the passage with surrounding context. For CSV files, returns the entire row that the passage belongs to.
 * For text files, context is cut intelligently to avoid breaking sentences or lines.
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
  minPrecedingContext: number,
  minTrailingContext: number,
  markPassageInResult: boolean,
  dataIsCSV: boolean
): string => {
  const passageOrder = passage.order;

  // Obtain preceding context based on whether passages are from CSV or not
  let precedingContext = "";
  let trailingContext = "";
  if (dataIsCSV) {
    // If passages are from CSV, only inlude preceding context from the same row, if any
    precedingContext = getPrecedingContextFromCsvRow(passage, passages);
    // If passage already contains end of row marker, no trailing context to add
    if (!passage.text.trim().endsWith("\u001E")) {
      trailingContext = getTrailingContextFromCsvRow(passage, passages);
    }
  } else {
    const precedingText = passages
      .filter((p) => p.order < passageOrder)
      .map((p) => p.text)
      .join("");
    precedingContext = getPrecedingContext(
      precedingText,
      minPrecedingContext,
      100
    );
    const trailingText = passages
      .filter((p) => p.order > passageOrder)
      .map((p) => p.text)
      .join("");
    trailingContext = getTrailingContext(
      trailingText,
      minTrailingContext,
      100
    );
  }

  if (markPassageInResult) {
    return `${precedingContext}<<<${passage.text}>>>${trailingContext}`;
  } else {
    return `${precedingContext}${passage.text}${trailingContext}`;
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
  minContextWindowSize: number,
  dataIsCSV: boolean
): { precedingText: string; searchArea: string } => {
  // If there's only one passage, return its text split at searchStartIndex
  if (passages.length === 1) {
    return {
      precedingText: passages[0].text.slice(0, searchStartIndex),
      searchArea: passages[0].text.slice(searchStartIndex),
    };
  }

  const passageOrder = startPassage.order;

  // Construct uncut preceding text
  let precedingText =
    passages
      .filter((p) => p.order < passageOrder)
      .map((p) => p.text)
      .join("") + startPassage.text.slice(0, searchStartIndex);

  // Construct uncut search area text, stopping before the first highlighted passage after startPassage
  const followingPassages = passages.filter((p) => p.order > passageOrder);
  const firstHighlightedIdx = followingPassages.findIndex((p) => p.isHighlighted);
  const tailPassages =
    firstHighlightedIdx === -1
      ? followingPassages
      : followingPassages.slice(0, firstHighlightedIdx);

  let searchArea =
    startPassage.text.slice(searchStartIndex) +
    tailPassages.map((p) => p.text).join("");

  // If passages are from CSV, limit preceding text to same row only, and return
  if (dataIsCSV) {
    precedingText =
      getPrecedingContextFromCsvRow(startPassage, passages) +
      startPassage.text.slice(0, searchStartIndex);
    const searchAreaSize = minContextWindowSize - precedingText.length;
    return {
      precedingText: precedingText,
      searchArea: getTrailingContext(searchArea, searchAreaSize > 0 ? searchAreaSize : 300, 200),  // In the rare case precedingText is already larger than minContextWindowSize, just cut searchArea to 300 chars
    };
  }

  // Else: passages are not from CSV
  const precedingSize = Math.floor(minContextWindowSize / 5); // max 20% of context window for preceding text
  const searchAreaSize = minContextWindowSize - precedingSize; // remaining context window for search area

  // If preceding text is already short enough, only cut search area
  if (precedingText.length <= precedingSize) {
    return {
      precedingText: precedingText,
      searchArea: getTrailingContext(searchArea, searchAreaSize, 200),
    };
  }

  // Cut preceding text to suitable length
  precedingText = getPrecedingContext(precedingText, precedingSize, 200);
  // Cut search area to suitable length
  searchArea = getTrailingContext(searchArea, searchAreaSize, 200);

  return { precedingText, searchArea };
};

/** Constructs few-shot examples string for the system prompt based on existing coded passages.
 * @param passage The passage for which to construct few-shot examples (to exclude from examples)
 * @param passages All passages in the document
 * @param codes All codes in the document
 * @param dataIsCSV Whether the data is from a CSV file
 * @returns The few-shot examples, or null if no coded passages exist.
 */
export const constructFewShotExamplesString = (
  passage: Passage,
  passages: Passage[],
  codes: Code[],
  dataIsCSV: boolean
) => {
  const codedPassages = passages.filter(
    (p) => p.id !== passage.id && p.codeIds.length > 0
  );
  if (codedPassages.length === 0) {
    return null;
  }

  // Randomly choose up to 10 coded examples for few-shot examples
  const fewShotExamples = codedPassages
    .sort(() => Math.random() - 0.5)
    .slice(0, 10)
    .map((p) => {
      const codes_: string[] = p.codeIds
        .map((id) => codes.find((c) => c.id === id)?.code)
        .filter(Boolean) as string[];

      const surroundingContext = getPassageWithSurroundingContext(
        p,
        passages,
        80,
        20,
        false,
        dataIsCSV
      );
      const hasSurroundingContext = surroundingContext.trim() !== p.text.trim();

      return JSON.stringify(
        {
          passage: p.text, 
          surroundingContext: hasSurroundingContext
            ? surroundingContext
            : "None",
          codes: codes_,
        },
        null,
        2
      );
    })
    .join(",\n");

  return fewShotExamples;
};

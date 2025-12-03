import { useContext } from "react";
import {
  CodeId,
  Passage,
  PassageId,
  WorkflowContext,
} from "../../../../context/WorkflowContext";

/**
 * A custom hook to handle addition of new highlighted passages in the coding workspace
 * @param setActiveCodeId - Function to update the active code ID.
 * @returns An object containing the function to create new passages, or null if creating the passage failed.
 */
export const usePassageSegmenter = () => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useCodeManager must be used within a WorkflowProvider");
  }

  const {
    setCodes,
    passages,
    setPassages,
    nextCodeIdNumber,
    setNextCodeIdNumber,
    nextPassageIdNumber,
    setNextPassageIdNumber,
    setActiveCodeId,
  } = context;

  /**
   * Creates a new passage based on the provided range selection.
   * Ensures no overlapping passages are created
   * @param range The range selection from which to create a new passage
   * @param initialCodes Optional initial codes to assign to the new passage
   * @returns The ID of the newly highlighted passage, or null if creation failed
   */
  const createNewPassage = (range: Range, initialCodeSuggestions: string[] = []) => {
    // If there's no real range (i.e. not a highlight, just a click), do nothing.
    if (range.collapsed) {
      console.log("Range is collapsed, no passage created.");
      return null;
    }

    // Save relevant information about the range
    const startNode = range.startContainer;
    const endNode = range.endContainer;
    if (!startNode || !endNode) {
      console.log("Start or end node undefined");
      return null;
    }
    const sourceText = startNode.textContent;
    const sourceId =
      startNode.parentNode instanceof HTMLElement
        ? startNode.parentNode.id // The id element contains the order of the passage
        : undefined;
    const sourcePassage = passages.find((p) => p.id === sourceId);
    if (!sourcePassage) {
      console.warn("Source passage not found.");
      return null;
    }
    const sourceOrder = sourcePassage?.order;
    if (!sourceText || sourceOrder === undefined) {
      console.log("SourceText, passage, its id, or order undefined.");
      return null;
    }

    // 2. Validate selection
    // If selection spans multiple nodes OR sourcePassage already has codes (i.e. has been highlighted before)
    //     alert user about overlapping passages and return early
    if (startNode !== endNode || sourcePassage.codeIds.length > 0) {
      alert(
        "Overlapping passages not allowed! Please select a new passage or click an existing code to edit it."
      );
      window.getSelection()?.removeAllRanges();
      return null;
    }

    // 3. Split passage text
    // First, normalize offsets (selection can be backward)
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;
    // Get the splitted passages
    const beforeHighlighted = sourceText.slice(0, startOffset);
    const highlighted = sourceText.slice(startOffset, endOffset);
    const afterHighlighted = sourceText.slice(endOffset);
    if (highlighted.trim().length === 0) {
      console.log(
        "Length of highlight is 0, or highlight contains only whitespace"
      );
      return null;
    }

    // 4. Get next available code and passage ids
    const newCodeIdNumber = nextCodeIdNumber;
    const newCodeId: CodeId = `code-${newCodeIdNumber}`;
    let newPassageIdNumber = nextPassageIdNumber; // Extract numeric part
    const getNextPassageId = () => {
      const id = `passage-${newPassageIdNumber++}` as PassageId;
      return id;
    };

    // 5. Create a variable for saving the of the highlighted passage to which the new code is attached
    let highlightedPassageId: PassageId | null = null;

    // 6. Create new passages depending on edge cases
    let newPassages: Passage[] = [];
    // Case A: highlight covers entire passage (previously highlighted passages before and after):
    //     attach newCodeId to sourcePassage.codeIds
    if (beforeHighlighted.length === 0 && afterHighlighted.length === 0) {
      newPassages = [
        {
          ...sourcePassage,
          isHighlighted: true,
          codeIds: [...(sourcePassage.codeIds || []), newCodeId],
          codeSuggestions: initialCodeSuggestions,
          nextHighlightSuggestion: null,
        },
      ];
      highlightedPassageId = sourcePassage.id;
    }
    // Case B: highlight at start, or right after another highlighted passage:
    //     new passages = [highlighted with newCodeId in codeIds, afterHighlighted without codes]
    else if (beforeHighlighted.length === 0) {
      newPassages = [
        {
          id: getNextPassageId(),
          order: sourceOrder,
          text: highlighted,
          isHighlighted: true,
          codeIds: [newCodeId],
          codeSuggestions: initialCodeSuggestions,
          autocompleteSuggestions: [],
          nextHighlightSuggestion: null,
        },
        {
          id: getNextPassageId(),
          order: sourceOrder + 1,
          text: afterHighlighted,
          isHighlighted: false,
          codeIds: [],
          codeSuggestions: [],
          autocompleteSuggestions: [],
          nextHighlightSuggestion: null,
        },
      ];
      highlightedPassageId = `passage-${newPassageIdNumber - 2}`;
    }
    // Case C: highlight at end, or right before another highlighted passage:
    //     new passages = [beforeHighlighted without codes, highlighted with newCodeId in codeIds]
    else if (afterHighlighted.length === 0) {
      newPassages = [
        {
          id: getNextPassageId(),
          order: sourceOrder,
          text: beforeHighlighted,
          isHighlighted: false,
          codeIds: [],
          codeSuggestions: [],
          autocompleteSuggestions: [],
          nextHighlightSuggestion: null,
        },
        {
          id: getNextPassageId(),
          order: sourceOrder + 1,
          text: highlighted,
          isHighlighted: true,
          codeIds: [newCodeId],
          codeSuggestions: initialCodeSuggestions,
          autocompleteSuggestions: [],
          nextHighlightSuggestion: null,
        },
      ];
      highlightedPassageId = `passage-${newPassageIdNumber - 1}`;
    }
    // Case D: highlight in the middle of an unhighlighted passage:
    //     new passages = [beforeHighlighted, highlighted with newCodeId in codeIds, afterHighlighted]
    else {
      newPassages = [
        {
          id: getNextPassageId(),
          order: sourceOrder,
          text: beforeHighlighted,
          isHighlighted: false,
          codeIds: [],
          codeSuggestions: [],
          autocompleteSuggestions: [],
          nextHighlightSuggestion: null,
        },
        {
          id: getNextPassageId(),
          order: sourceOrder + 1,
          text: highlighted,
          isHighlighted: true,
          codeIds: [newCodeId],
          codeSuggestions: initialCodeSuggestions,
          autocompleteSuggestions: [],
          nextHighlightSuggestion: null,
        },
        {
          id: getNextPassageId(),
          order: sourceOrder + 2,
          text: afterHighlighted,
          isHighlighted: false,
          codeIds: [],
          codeSuggestions: [],
          autocompleteSuggestions: [],
          nextHighlightSuggestion: null,
        },
      ];
      highlightedPassageId = `passage-${newPassageIdNumber - 2}`;
    }

    // 7. Update the nextId states
    setNextCodeIdNumber(newCodeIdNumber + 1);
    setNextPassageIdNumber(newPassageIdNumber);

    // 7. Update passages state
    setPassages((prev) => {
      // Remove original sourcepassage, increment positions (order) of subsequent passages, and insert new passages
      const updated = [
        ...prev
          .filter((p) => p.order !== sourceOrder)
          .map((p) =>
            p.order > sourceOrder
              ? { ...p, order: p.order + (newPassages.length - 1) }
              : p
          ),
        ...newPassages,
      ];
      // Sort by order
      const sorted = [...updated].sort((a, b) => a.order - b.order);
      // re-index orders strictly by index for safety
      const reIndexed = sorted.map((p, index) => ({ ...p, order: index }));
      console.log("Re-indexed passages:", reIndexed);
      return reIndexed;
    });

    // 9. Add the new code to the codes state and the codebook
    setCodes((prev) => [
      ...prev,
      {
        id: newCodeId,
        passageId: highlightedPassageId,
        code: "",
      },
    ]);

    // 10. The newly added code should be active
    setActiveCodeId(newCodeId);

    return highlightedPassageId;
  };

  return { createNewPassage };
};

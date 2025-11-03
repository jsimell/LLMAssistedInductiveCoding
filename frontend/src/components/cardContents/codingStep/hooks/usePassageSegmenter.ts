import { useContext } from "react";
import { Passage, WorkflowContext } from "../../../../context/WorkflowContext";
import { useAIsuggestionManager } from "./useAIsuggestionManager";

interface UsePassageSegmenterProps {
  setActiveCodeId: React.Dispatch<React.SetStateAction<number | null>>;
}

/**
 * A custom hook to handle addition of new highlighted passages in the coding workspace
 * @param setActiveCodeId - Function to update the active code ID.
 * @returns An object containing a function to segment highlighted text into passages and codes.
 */
export const usePassageSegmenter = ({
  setActiveCodeId,
}: UsePassageSegmenterProps) => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useCodeManager must be used within a WorkflowProvider");
  }

  const {
    setCodes,
    passages,
    setPassages,
    nextCodeId,
    setNextCodeId,
    nextPassageId,
    setNextPassageId,
  } = context;

  const { updateSuggestionsForPassage } = useAIsuggestionManager();

  /**
   * This function gets called when the user highlights a passage in the coding interface.
   * It creates a new passage based on the highlighted text, and adds an empty code linked to it.
   * Ensures that no overlapping highlights occur.
   */
  const createNewPassage = () => {
    // 1. Get selection, save relevant information, and do some basic validation
    const selection = window.getSelection();
    if (!selection) {
      console.log("Selection undefined");
      return;
    }
    // If there's no real range (i.e. not a highlight, just a click), do nothing.
    if (selection.isCollapsed) {
      return;
    }
    const startNode = selection.anchorNode;
    const endNode = selection.focusNode;
    if (!startNode || !endNode) {
      console.log("Start or end node undefined");
      return;
    }
    const sourceText = startNode.textContent;
    const sourceId =
      startNode.parentNode instanceof HTMLElement
        ? Number(startNode.parentNode.id) // The id element contains the order of the passage
        : undefined;
    const sourcePassage = passages.find((p) => p.id === sourceId);
    const sourceOrder = sourcePassage?.order;
    if (
      !sourcePassage ||
      !sourceText ||
      sourceId === undefined ||
      sourceOrder === undefined
    ) {
      console.log("SourceText, passage, its id, or order undefined.");
      return;
    }

    // 2. Validate selection
    // If selection spans multiple nodes OR sourcePassage already has codes (i.e. has been highlighted before):
    //     alert user about overlapping passages and return early
    if (startNode !== endNode || sourcePassage.codeIds.length > 0) {
      alert(
        "Overlapping passages not allowed! Please select a new passage or click an existing code to edit it."
      );
      return;
    }

    // 3. Split passage text
    // First, normalize offsets (selection can be backward)
    const anchorOffset = selection.anchorOffset;
    const focusOffset = selection.focusOffset;
    const startOffset = Math.min(anchorOffset, focusOffset);
    const endOffset = Math.max(anchorOffset, focusOffset);
    // Get the splitted passages
    const beforeHighlighted = sourceText.slice(0, startOffset);
    const highlighted = sourceText.slice(startOffset, endOffset);
    const afterHighlighted = sourceText.slice(endOffset);
    if (highlighted.trim().length === 0) {
      console.log(
        "Length of highlight is 0, or highlight contains only whitespace"
      );
      return;
    }

    // 4. Get next available code and passage ids
    const newCodeId = nextCodeId;
    let newPassageId = nextPassageId;

    // 5. Create a variable for storing the information on which passage the new code is linked to
    let passageIdOfNewCode: number | null = null;

    // 5. Create new passages depending on edge cases
    let newPassages: Passage[] = [];
    // Case A: highlight covers entire passage (previously highlighted passages before and after):
    //     attach newCodeId to sourcePassage.codeIds
    if (beforeHighlighted.length === 0 && afterHighlighted.length === 0) {
      newPassages = [
        { ...sourcePassage, codeIds: sourcePassage.codeIds.concat(newCodeId) },
      ];
      passageIdOfNewCode = sourcePassage.id;
    }
    // Case B: highlight at start, or right after another highlighted passage:
    //     new passages = [highlighted with newCodeId in codeIds, afterHighlighted without codes]
    else if (beforeHighlighted.length === 0) {
      newPassages = [
        {
          id: newPassageId++,
          order: sourceOrder,
          text: highlighted,
          codeIds: [newCodeId],
          aiSuggestions: [],
        },
        {
          id: newPassageId++,
          order: sourceOrder + 1,
          text: afterHighlighted,
          codeIds: [],
          aiSuggestions: [],
        },
      ];
      passageIdOfNewCode = newPassageId - 2;
    }
    // Case C: highlight at end, or right before another highlighted passage:
    //     new passages = [beforeHighlighted without codes, highlighted with newCodeId in codeIds]
    else if (afterHighlighted.length === 0) {
      newPassages = [
        {
          id: newPassageId++,
          order: sourceOrder,
          text: beforeHighlighted,
          codeIds: [],
          aiSuggestions: [],
        },
        {
          id: newPassageId++,
          order: sourceOrder + 1,
          text: highlighted,
          codeIds: [newCodeId],
          aiSuggestions: [],
        },
      ];
      passageIdOfNewCode = newPassageId - 1;
    }
    // Case D: highlight in the middle of an unhighlighted passage:
    //     new passages = [beforeHighlighted, highlighted with newCodeId in codeIds, afterHighlighted]
    else {
      newPassages = [
        {
          id: newPassageId++,
          order: sourceOrder,
          text: beforeHighlighted,
          codeIds: [],
          aiSuggestions: [],
        },
        {
          id: newPassageId++,
          order: sourceOrder + 1,
          text: highlighted,
          codeIds: [newCodeId],
          aiSuggestions: [],
        },
        {
          id: newPassageId++,
          order: sourceOrder + 2,
          text: afterHighlighted,
          codeIds: [],
          aiSuggestions: [],
        },
      ];
      passageIdOfNewCode = newPassageId - 2;
    }

    // 6. Update the nextId states
    setNextCodeId(newCodeId + 1);
    setNextPassageId(newPassageId);

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
      const sorted = updated.sort((a, b) => a.order - b.order);
      // re-index orders strictly by index for safety
      return sorted.map((p, index) => ({ ...p, order: index }));
    });

    // 8. Add the new code to the codes state and the codebook
    setCodes((prev) => [
      ...prev,
      { id: newCodeId, passageId: passageIdOfNewCode, code: "" },
    ]);

    // 9. Update the AI suggestions for all the new passages.
    // The setTimeout call ensures that the AI suggestions update only after the previous passages state update finishes.
    const idsToUpdate = newPassages.map(p => p.id);
    setTimeout(() => {
      idsToUpdate.forEach((id) => updateSuggestionsForPassage(id));
    }, 0);

    // 10. Newly added code should be active -> update activeCodeId
    setActiveCodeId(newCodeId);
  };

  return { createNewPassage };  
};
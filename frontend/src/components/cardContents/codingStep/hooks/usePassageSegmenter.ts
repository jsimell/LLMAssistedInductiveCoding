import { useContext, useEffect, useRef } from "react";
import { CodeId, Passage, PassageId, WorkflowContext } from "../../../../context/WorkflowContext";
import { useCodeSuggestions } from "./apiCommunication/useCodeSuggestions";
import { useHighlightSuggestions } from "./apiCommunication/useHighlightSuggestions";

interface UsePassageSegmenterProps {
  setActiveCodeId: React.Dispatch<React.SetStateAction<CodeId | null>>;
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
    codes,
    setCodes,
    passages,
    setPassages,
    nextCodeIdNumber,
    setNextCodeIdNumber,
    nextPassageIdNumber,
    setNextPassageIdNumber,
  } = context;

  const { getNextHighlightSuggestion } = useHighlightSuggestions();
  const { getCodeSuggestions } = useCodeSuggestions();

  // Track which passages need AI suggestions
  const highlightSuggestionsQueueRef = useRef<Passage[]>([]);
  const codeSuggestionsQueueRef = useRef<Passage[]>([]);

  useEffect(() => {
    const currentQueue = [...highlightSuggestionsQueueRef.current, ...codeSuggestionsQueueRef.current];
    highlightSuggestionsQueueRef.current = [];
    codeSuggestionsQueueRef.current = [];

    currentQueue.forEach(async (targetPassage) => {
      if (targetPassage.isHighlighted) {
        const existingCodes = targetPassage.codeIds.map(
          (cid) => codes.find((c) => c.id === cid)?.code || ""
        ).filter(Boolean);
        getCodeSuggestions(targetPassage, existingCodes).then((suggestions) => {
          setPassages((prev) => {
            const upToDateTarget = prev.find((p) => p.id === targetPassage.id);
            if (!upToDateTarget || !upToDateTarget.isHighlighted || !areCodeIdsEqual(upToDateTarget.codeIds, targetPassage.codeIds)) {
              return prev; // Passage state changed - ignore stale response
            }
            return prev.map((p) =>
              p.id === targetPassage.id
                ? { ...p, codeSuggestions: suggestions, isHighlighted: true, nextHighlightSuggestion: null }
                : p
            );
          });
        })
        .catch((error) => {
          console.error(`Failed to fetch code suggestions for passage ${targetPassage.text.slice(0, 30)+ "..."}:`, error);
        });
      } else {
        // If passage is not highlighted, fetch highlight suggestions
        getNextHighlightSuggestion(targetPassage, 0).then((suggestion) => {
          setPassages((prev) => {
            const upToDateTarget = prev.find((p) => p.id === targetPassage.id);
            if (!upToDateTarget || upToDateTarget.isHighlighted || !areCodeIdsEqual(upToDateTarget.codeIds, targetPassage.codeIds)) {
              return prev; // Passage state changed - ignore stale response
            }
            return prev.map((p) =>
              p.id === targetPassage.id
                ? { ...p, isHighlighted: false, codeIds: [], codeSuggestions: [], nextHighlightSuggestion: suggestion }
                : p
            );
          });
        })
        .catch((error) => {
          console.error(`Failed to fetch highlight suggestion for passage ${targetPassage.text.slice(0, 30)+ "..."}:`, error);
        });
      }
    });
  }, [passages]);


  /**
   * Helper to check if two codeId arrays are equal
   */
  const areCodeIdsEqual = (ids1: string[], ids2: string[]): boolean => {
    if (ids1.length !== ids2.length) return false;
    return ids1.every((id, index) => id === ids2[index]);
  };


  /** 
   * Creates a new passage based on the provided range selection.
   * Ensures no overlapping passages are created
   * @param range The range selection from which to create a new passage
   */
  const createNewPassage = (range: Range, initialCodes: string[] = []) => {
    // If there's no real range (i.e. not a highlight, just a click), do nothing.
    if (range.collapsed) {
      return;
    }
    // Save relevant information about the range
    const startNode = range.startContainer;
    const endNode = range.endContainer;
    if (!startNode || !endNode) {
      console.log("Start or end node undefined");
      return;
    }
    const sourceText = startNode.textContent;
    const sourceId =
      startNode.parentNode instanceof HTMLElement
        ? startNode.parentNode.id // The id element contains the order of the passage
        : undefined;
    const sourcePassage = passages.find((p) => p.id === sourceId);
    if (!sourcePassage) {
      console.warn("Source passage not found.");
      return;
    }
    const sourceOrder = sourcePassage?.order;
    if (
      !sourceText ||
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
      return;
    }

    // 4. Get next available code and passage ids
    const newCodeIdNumber = nextCodeIdNumber;
    const newCodeId: CodeId = `code-${newCodeIdNumber}`;
    let newPassageIdNumber = nextPassageIdNumber; // Extract numeric part
    const getNextPassageId = () => {
      const id = `passage-${newPassageIdNumber++}` as PassageId;
      return id;
    }

    // 5. Create a variable for storing the information on which passage the new code is linked to
    let passageIdOfNewCode: string | null = null;

    // 5. Create new passages depending on edge cases
    let newPassages: Passage[] = [];
    // Case A: highlight covers entire passage (previously highlighted passages before and after):
    //     attach newCodeId to sourcePassage.codeIds
    if (beforeHighlighted.length === 0 && afterHighlighted.length === 0) {
      newPassages = [
        { 
          ...sourcePassage, 
          isHighlighted: true, 
          codeIds: [...(sourcePassage.codeIds || []), newCodeId], 
          codeSuggestions: [],
          nextHighlightSuggestion: null
        },
      ];
      passageIdOfNewCode = sourcePassage.id;
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
          codeSuggestions: [],
          nextHighlightSuggestion: null,
        },
        {
          id: getNextPassageId(),
          order: sourceOrder + 1,
          text: afterHighlighted,
          isHighlighted: false,
          codeIds: [],
          codeSuggestions: [],
          nextHighlightSuggestion: null,
        },
      ];
      passageIdOfNewCode = `passage-${newPassageIdNumber - 2}`;
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
          nextHighlightSuggestion: null,
        },
        {
          id: getNextPassageId(),
          order: sourceOrder + 1,
          text: highlighted,
          isHighlighted: true,
          codeIds: [newCodeId],
          codeSuggestions: [],
          nextHighlightSuggestion: null,
        },
      ];
      passageIdOfNewCode = `passage-${newPassageIdNumber - 1}`;
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
          nextHighlightSuggestion: null,
        },
        {
          id: getNextPassageId(),
          order: sourceOrder + 1,
          text: highlighted,
          isHighlighted: true,
          codeIds: [newCodeId],
          codeSuggestions: [],
          nextHighlightSuggestion: null,
        },
        {
          id: getNextPassageId(),
          order: sourceOrder + 2,
          text: afterHighlighted,
          isHighlighted: false,
          codeIds: [],
          codeSuggestions: [],
          nextHighlightSuggestion: null,
        },
      ];
      passageIdOfNewCode = `passage-${newPassageIdNumber - 2}`;
    }

    // 6. Update the nextId states
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
      const sorted = updated.sort((a, b) => a.order - b.order);
      // re-index orders strictly by index for safety
      return sorted.map((p, index) => ({ ...p, order: index }));
    });

    // 8. Add the new code to the codes state and the codebook
    setCodes((prev) => [
      ...prev,
      { id: newCodeId as CodeId, passageId: passageIdOfNewCode as PassageId, code: initialCodes.join("; ") },
    ]);

    // 9. Add new passages to appropriate suggestion queues
    highlightSuggestionsQueueRef.current = newPassages.filter(p => !p.isHighlighted);
    codeSuggestionsQueueRef.current = newPassages.filter(p => p.isHighlighted);

    // 10. Newly added code should be active -> update activeCodeId
    setActiveCodeId(newCodeId);
  };

  return { createNewPassage };  
};

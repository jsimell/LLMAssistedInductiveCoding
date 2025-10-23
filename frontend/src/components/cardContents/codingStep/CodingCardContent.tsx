import { useState, useContext, useEffect, useRef, ChangeEvent } from "react";
import { Code, Passage, WorkflowContext } from "../../../context/WorkflowContext";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { PencilSquareIcon } from "@heroicons/react/24/solid";
import ToggleSwitch from "../../ToggleSwitch";
import Codebook from "./Codebook";
import { useCodeManager } from "./useCodeManager";
import CodeBlob from "./CodeBlob";

const CodingCardContent = () => {
  // Local state for tracking the currently active code input
  const [activeCodeId, setActiveCodeId] = useState<number | null>(null);

  const { deleteCode, updateCode, handleKeyDown } = useCodeManager({
    activeCodeId,
    setActiveCodeId,
  });

  // Get global states and setters from the context
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("WorkflowContext must be used within a WorkflowProvider");
  }
  const {
    passages,
    setPassages,
    codes,
    setCodes,
    codebook,
    setCodebook,
    nextCodeId,
    setNextCodeId,
    nextPassageId,
    setNextPassageId,
    setProceedAvailable,
    aiSuggestionsEnabled,
    setAiSuggestionsEnabled,
  } = context;


  // Moving to the next step should be allowed by default in this step
  useEffect(() => {
    setProceedAvailable(true);
  }, []);

  const passagesContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!passagesContainerRef.current) return;
    const inputs: NodeListOf<HTMLInputElement> = passagesContainerRef.current.querySelectorAll("input");
    inputs.forEach((input) => {
      input.style.width = "1px";
      input.style.width = `${input.scrollWidth + 4}px`;
    });
  }, []);

  // The purpose of the below is:
  // 1. ensure that the active code automatically gets focus when it is first created
  // 2. ensure that the codebook gets updated when activeCodeId changes (i.e., when user clicks on a code blob, or outside to defocus)
  //    This removes the need to use the onBlur event on the input of the code blob.
  const activeCodeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (activeCodeRef.current) {
      activeCodeRef.current.focus();
    }
    setCodebook(new Set(codes.map((c) => c.code)));
  }, [activeCodeId]);

  /**
   * This function gets called when the user highlights a passage in the coding interface.
   */
  const handleHighlight = () => {
    // 1. Get selection and save relevant information
    const selection = window.getSelection();
    if (!selection) {
      console.log("Selection undefined");
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
        },
        {
          id: newPassageId++,
          order: sourceOrder + 1,
          text: afterHighlighted,
          codeIds: [],
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
        },
        {
          id: newPassageId++,
          order: sourceOrder + 1,
          text: highlighted,
          codeIds: [newCodeId],
        },
      ];
      passageIdOfNewCode = newPassageId - 1;
    }
    // Case D: highlight in the middle of an unhighlighted passage:
    //     new passages = [beforeHighlighted, highlighted with newCodeId in codeIds, afterHighlighted]
    else {
      passageIdOfNewCode = newPassageId;
      newPassages = [
        {
          id: newPassageId++,
          order: sourceOrder,
          text: beforeHighlighted,
          codeIds: [],
        },
        {
          id: newPassageId++,
          order: sourceOrder + 1,
          text: highlighted,
          codeIds: [newCodeId],
        },
        {
          id: newPassageId++,
          order: sourceOrder + 2,
          text: afterHighlighted,
          codeIds: [],
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
      { id: newCodeId, passageId: newPassageId.toString(), code: "" },
    ]);

    // 9. Newly added code should be active -> update activeCodeId
    setActiveCodeId(newCodeId);
  };

  /**
   *
   * @param p - the passage to be rendered
   * @returns - the jsx code of the passage
   */
  const renderPassage = (p: Passage) => {
    // If the passage ends with a line break, a line break should be added after the last code blob
    const endsWithLineBreak = p.text.endsWith("\n");

    return (
      <span key={p.id}>
        <span
          id={p.id.toString()}
          onMouseDown={() =>
            p.codeIds?.length > 0 && setActiveCodeId(p.codeIds[0])
          }
          className={
            p.codeIds?.length > 0
              ? "bg-tertiaryContainer hover:bg-tertiaryContainerHover cursor-pointer rounded-sm px-1 w-fit mr-1"
              : ""
          }
        >
          {p.text}
        </span>
        {p.codeIds?.length > 0 &&
          p.codeIds.map((codeId) => 
            <CodeBlob codeId={codeId} hasTrailingBreak={endsWithLineBreak} activeCodeId={activeCodeId} setActiveCodeId={setActiveCodeId} activeCodeRef={activeCodeRef}/>
          )}
      </span>
    );
  };

  return (
    <div className="flex w-full gap-7">
      <div
        onMouseUp={handleHighlight}
        className="flex-1 rounded-xl border-1 border-outline p-8 text-onBackground text-base whitespace-pre-wrap"
        ref={passagesContainerRef}
      >
        {passages.map((p) => renderPassage(p))}
      </div>
      <div className="flex flex-col gap-4 sticky top-5 h-fit">
        <Codebook />
        <div className="flex gap-2 items-center justify-center rounded-xl border-1 border-outline p-6">
          <p>AI suggestions</p>
          <ToggleSwitch
            booleanState={aiSuggestionsEnabled}
            setBooleanState={setAiSuggestionsEnabled}
          />
        </div>
      </div>
    </div>
  );
};

export default CodingCardContent;

import { useState, useContext, useEffect, useRef, ChangeEvent } from "react";
import { Code, Passage, WorkflowContext } from "../../context/WorkflowContext";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { PencilSquareIcon } from "@heroicons/react/24/solid";
import ToggleSwitch from "../ToggleSwitch";

const CodingCardContent = () => {
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

  const [activeCodeId, setActiveCodeId] = useState<number | null>(null);

  // Moving to the next step should be allowed by default in this step
  useEffect(() => {
    setProceedAvailable(true);
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
   * Used for handling a keyboard event.
   * @param e - the keyboard event that triggered the function call
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (activeCodeId === null) return;
    if (!e.currentTarget) return;
    const newValue = e.currentTarget.value;
    if (["Enter", "Tab", "Escape"].includes(e.key)) {
      e.preventDefault(); // Prevents default behaviour of the tab button
      const codeObject: Code | undefined = codes.find(
        (c) => c.id === activeCodeId
      );
      if (!codeObject) return;
      const { id, code } = codeObject;
      if (id === undefined || code === undefined) return;
      if (codeObject.code.length === 0) {
        deleteCode(activeCodeId);
        return;
      }
      setCodebook((prev) => new Set([...prev, newValue]));
      setActiveCodeId(null);
      e.currentTarget.blur();
      return;
    }
    if (e.key === "Delete") {
      e.preventDefault();
      deleteCode(activeCodeId);
    }
  };

  /**
   * Updates the value of a specific code.
   * @param id - the id of the code to be updated
   * @param newValue - the new value of the code
   */
  const updateCode = (id: number, newValue: string) => {
    setCodes((prev) =>
      prev.map((c) => (c.id === id ? { ...c, code: newValue } : c))
    );
  };

  /**
   * Deletes a code.
   * @param id - the id of the code to be deleted
   */
  const deleteCode = (id: number) => {
    // 1. Remove the code from the codes array
    const updatedCodes = codes.filter((c) => c.id !== id);
    setCodes(() => updatedCodes);

    // 2. Update the codebook
    // After deleting, recalculate the codebook from the remaining codes
    setCodebook(new Set(updatedCodes.map((c) => c.code)));

    // 3. Find the passage that contains this codeId
    const passage = passages.find((p) => p.codeIds.includes(id));
    if (!passage) return;

    // 4. Remove the codeId from the passage’s codeIds
    const updatedPassage = {
      ...passage,
      codeIds: passage.codeIds.filter((cid) => cid !== id),
    };

    // 5. Check whether the updated passage still has codeIds left
    // If it still has other codes, simply replace it in the passages array and return
    if (updatedPassage.codeIds.length > 0) {
      setPassages((prev) =>
        prev.map((p) => (p.id === updatedPassage.id ? updatedPassage : p))
      );
      return;
    }

    // 6. If the passage has no codes left:
    //    Check its neighbors based on order
    const prevPassage = passages.find(
      (p) => p.order === updatedPassage.order - 1
    );
    const nextPassage = passages.find(
      (p) => p.order === updatedPassage.order + 1
    );
    const mergePrev = prevPassage && prevPassage.codeIds.length === 0;
    const mergeNext = nextPassage && nextPassage.codeIds.length === 0;

    // 7. Determine merged text and which passages to remove from the passages state
    let mergedText = updatedPassage.text;
    let passagesToRemove = [updatedPassage.id];
    if (mergePrev) {
      mergedText = prevPassage.text + mergedText;
      passagesToRemove.push(prevPassage.id);
    }
    if (mergeNext) {
      mergedText = mergedText + nextPassage.text;
      passagesToRemove.push(nextPassage.id);
    }

    // 8. Create a new merged passage (empty codeIds)
    const newMergedPassage = {
      id: updatedPassage.id, // reuse the current one’s id
      order: mergePrev ? prevPassage.order : updatedPassage.order,
      text: mergedText,
      codeIds: [],
    };

    // 9. Update the passages state:
    setPassages((prev) => {
      const filtered = prev.filter((p) => !passagesToRemove.includes(p.id));
      const inserted = [...filtered, newMergedPassage];
      const sorted = inserted.sort((a, b) => a.order - b.order);
      return sorted.map((p, i) => ({ ...p, order: i }));
    });

    // 10. No code should be active after deletion -> set activeCodeId to null
    setActiveCodeId(null);
  };

  /**
   *
   * @param codeId - the id of the code to be rendered
   * @param hasTrailingBreak - a boolean value indicating whether or not the highlight ends in a line break
   * @returns a jsx element containing the code of the code blob
   */
  const renderCodeBlob = (codeId: number, hasTrailingBreak: boolean) => {
    const codeObject = codes.find((c) => c.id === codeId);
    if (!codeObject) return null;
    return (
      <span
        key={codeId}
        className={`inline-flex items-center w-fit px-2 bg-tertiaryContainer border border-gray-500 rounded-full hover:bg-tertiaryContainerHover focus:bg-tertiaryContainerHover focus:outline-none focus:ring-1 focus:ring-onBackground`}
      >
        <input
          value={codeObject.code}
          size={Math.max(codeObject.code.length + 1, 8)}
          placeholder="Type code..."
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            updateCode(codeId, e.target.value);
            handleCodeBlobSizing(e);
          }}
          onFocus={() => setActiveCodeId(codeId)}
          onBlur={(e) => {
            updateCode(codeId, e.currentTarget.value);
            setActiveCodeId(null);
          }}
          onKeyDown={(e) => handleKeyDown(e)}
          ref={activeCodeId === codeId ? activeCodeRef : null} // used for ensuring that the input gets focused when it is first created
          className="bg-transparent border-none outline-none"
        />
        <button
          type="button"
          onClick={() => deleteCode(codeId)}
          className="bg-transparent text-gray-500 hover:text-gray-800 cursor-pointer"
        >
          <XMarkIcon className="size-5" />
        </button>
        {hasTrailingBreak && <br />}
      </span>
    );
  };

  /**
   * Adjusts the width of a code input to fit its current text.
   *
   * @param e - change event from the code input (`HTMLInputElement`).
   */
  const handleCodeBlobSizing = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    target.style.width = "1px";
    target.style.width = `${target.scrollWidth + 4}px`;
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
          p.codeIds.map((codeId) => {
            return renderCodeBlob(codeId, endsWithLineBreak);
          })}
      </span>
    );
  };

  /**
   * Used for rendering the codebook
   * @returns - the jsx code of the codebook
   */
  const renderCodeBookContents = () => {
    const codebookArray = Array.from(codebook);
    return (
      <div className="flex flex-col w-full px-6 py-4 items-center">
        {codebookArray.filter((code) => code.trim().length > 0).length ===
          0 && <p>No codes yet</p>}
        {codebookArray.map((code) => (
          <div
            key={code}
            className="flex justify-between items-center gap-10 w-full"
          >
            {code.trim().length > 0 && (
              <>
                <span className="flex items-center gap-1.5 py-1">
                  {code.trim()}
                  <PencilSquareIcon className="w-6 h-6 p-0.5 flex-shrink-0 rounded-sm text-[#007a60] hover:bg-tertiary/10 cursor-pointer" />
                </span>
                <span>{`(${
                  codes.filter((c) => c.code.trim() === code.trim()).length
                })`}</span>
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex w-full gap-7">
      <div
        onMouseUp={handleHighlight}
        className="flex-1 rounded-xl border-1 border-outline p-8 text-onBackground text-base whitespace-pre-wrap"
      >
        {passages.map((p) => renderPassage(p))}
      </div>
      <div className="flex flex-col gap-4 sticky top-5 h-fit">
        <div className="flex flex-col items-center w-full h-fit min-w-50 max-w-sm rounded-xl border-1 border-outline">
          <div className="flex h-fit w-full items-center justify-center px-4.5 pt-4 pb-3.5 border-b border-outline rounded-t-xl bg-container text-primary">
            <p className="text-lg font-semibold">Codebook</p>
          </div>
          {renderCodeBookContents()}
        </div>
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

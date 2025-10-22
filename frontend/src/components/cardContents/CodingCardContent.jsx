import React, { useState, useContext, useEffect, useRef } from "react";
import { WorkflowContext } from "../../context/WorkflowContext";
import { XMarkIcon } from "@heroicons/react/24/outline";

const CodingCardContent = () => {
  const { passages, setPassages, codes, setCodes, setProceedAvailable } = useContext(WorkflowContext);

  const nextCodeIdRef = useRef(0);
  const activeCodeRef = useRef(null);  // A reference to the actual input element of the currently active code

  const [activeCodeId, setActiveCodeId] = useState(null);

  // Moving to the next step should be allowed by default in this step
  useEffect(() => {
    setProceedAvailable(true);
  }, []);

  useEffect(() => {
    if (activeCodeRef.current) {
      activeCodeRef.current.focus();
    }
  }, [activeCodeId])

  // This function gets called when the user highlights a passage in the workspace
  const handleMouseUp = () => {
    const selection = window.getSelection();
    const startNode = selection.anchorNode;
    const endNode = selection.focusNode;
    const sourceText = startNode.textContent;
    const sourcePosition = Number(startNode.parentNode.id);  // The id is equivalent to the position of the sourcePassage in the passages state variable
    const sourcePassage = passages.find(p => p.position === sourcePosition);
    const range = selection.getRangeAt(0);
    const beforeHighlighted = sourceText.slice(0, range.startOffset);
    const highlighted = selection.toString();
    const afterHighlighted = sourceText.slice(range.endOffset);

    // If passage is empty, do nothing
    if (highlighted.trim() === "") {
      return;
    }

    // Make sure the highlighted passage does not overlap with a code blob
    if (
      startNode.parentElement.closest('[data-code-id]') || 
      endNode.parentElement.closest('[data-code-id]') ||
      startNode.parentElement.tagName === 'INPUT' ||
      endNode.parentElement.tagName === 'INPUT'
    ) {
      return;
    }

    // Make sure that the highlighted passage is not overlapping with previously highlighted passages
    if (range.startContainer !== range.endContainer || sourcePassage.codeIds.length > 0) {
      alert("Overlapping passages not allowed! Please select a new passage or click an existing code to edit it.");
      return;
    }

    // Get the id to use for the new code, and increment nextCodeIdRef
    const newId = nextCodeIdRef.current;
    nextCodeIdRef.current += 1; 

    let newPassages = [];
    if (beforeHighlighted.length === 0 && afterHighlighted.length === 0) { // Edge case: Highlight between two already coded passages
      newPassages = [
        { ...sourcePassage, codeIds: sourcePassage.codeIds.concat(newId) }
      ]
    } else if (beforeHighlighted.length === 0) { // Edge case: Highlight in the beginning of data or immediately after a coded passage
      newPassages = [
        { position: sourcePosition, text: highlighted, codeIds: [newId] },
        { position: sourcePosition + 1, text: afterHighlighted, codeIds: [] }
      ]
    } else if (afterHighlighted.length === 0) { // Edge case: Highlight at the end of the data or right before a coded passage
      newPassages = [
        { position: sourcePosition, text: beforeHighlighted, codeIds: [] },
        { position: sourcePosition + 1, text: highlighted, codeIds: [newId] }
      ]
    } else { // Default case: Highlight in the middle of (an uncoded) passage
      newPassages = [
        { position: sourcePosition, text: beforeHighlighted, codeIds: [] },
        { position: sourcePosition + 1, text: highlighted, codeIds: [newId] },
        { position: sourcePosition + 2, text: afterHighlighted, codeIds: [] }
      ]
    }

    setPassages(prev => {
      const updated = [
        ...prev.filter(p => p.position !== sourcePosition).map(p =>
          p.position > sourcePosition ? { ...p, position: p.position + (newPassages.length - 1) } : p
        ),
        ...newPassages
      ];
      const sorted = updated.sort((a, b) => a.position - b.position);
      return sorted.map((p, index) => ({ ...p, position: index }));
    });

    setCodes(prev => [...prev, { id: newId, code: "" }]);
    setActiveCodeId(newId);
  };

  const handleKeyDown = (e) => {
    if (["Enter", "Tab", "Escape"].includes(e.key)) {
      e.preventDefault();  // Prevents default behaviour of the tab button
      /*if (codes.find(c => c.id === activeCodeId).code.length === 0) {
        deleteCode(activeCodeId);
        return;
      }*/
      e.target.blur();
      setActiveCodeId(null);
      return;
    } 
    if (e.key === "Delete") {
      e.preventDefault();
      deleteCode(activeCodeId);
    }
  }

  const updateCode = (id, newValue) => {
    setCodes(prev =>
      prev.map(c => (c.id === id ? { ...c, code: newValue } : c))
    );
  }

  const deleteCode = (id) => {
    // Delete the code from the codes state
    setCodes(prev => prev.filter(c => c.id !== id));
    // Make sure that the activeCodeId state is not pointing to the deleted code
    setActiveCodeId(null);

    // Update the passages state
    setPassages(prev => {
      // Step 1: find the passage that the code is attached to, and remove the code from the codeIds array of that passage.
      // NOTE: Remember that code ids are unique even for duplicate codes.
      const passage = prev.find(p => p.codeIds.includes(id));
      if (!passage) return prev; // nothing to delete, return current state
      let updatedPassage = { 
        ...passage, 
        codeIds: passage.codeIds.filter(codeId => codeId !== id) 
      };

      // Step 2: If the passage still has codes, simply update it
      if (updatedPassage.codeIds.length > 0) {
        return prev.map(p => p.position === passage.position ? updatedPassage : p);
      }

      // Step 3: Passage has no codes left - merge it with uncoded neighboring passages
      const pos = passage.position;
      const prevPassage = prev.find(p => p.position === pos - 1);
      const nextPassage = prev.find(p => p.position === pos + 1);
      const mergePrevious = prevPassage && prevPassage.codeIds.length === 0;
      const mergeNext = nextPassage && nextPassage.codeIds.length === 0;
      // Merge the passages
      const mergedText =
        (mergePrevious ? prevPassage.text : "") +
        updatedPassage.text +
        (mergeNext ? nextPassage.text : "");

      updatedPassage = { ...updatedPassage, text: mergedText, codeIds: [] };

      // Step 4: build the new array
      const positionsToRemove = [pos];
      if (mergePrevious) positionsToRemove.push(pos - 1);
      if (mergeNext) positionsToRemove.push(pos + 1);
      // Remove passages to be replaced by the merged passage
      let newPassages = prev.filter(p => !positionsToRemove.includes(p.position));
      // Insert the merged passage in the right position, and update the positions
      const insertPosition = Math.min(...positionsToRemove);
      newPassages.splice(insertPosition, 0, updatedPassage);
      newPassages = newPassages.map((p, index) => ({ ...p, position: index }));
      return newPassages;
    });
  };

  const renderCodeBlob = (codeId, hasTrailingBreak) => {
    const codeObject = codes.find((c) => c.id === codeId);
    if (!codeObject) return null;
    return (
      <span 
        key={`code${codeId}`} 
        data-code-id={codeId}
        onMouseDown={e => e.stopPropagation()}
        className={`inline-flex items-center w-fit pl-2 ${(activeCodeId !== codeId) && "pr-2"} bg-tertiaryContainer border border-gray-500 rounded-full hover:bg-tertiaryContainerHover focus:bg-tertiaryContainerHover focus:outline-none focus:ring-1 focus:ring-onBackground`}
      >
        <input
          value={codeObject.code}
          size={Math.max(codeObject.code.length + 1, 8)}
          placeholder="Type code..."
          onChange={(e) => {
            updateCode(codeId, e.target.value);
            handleCodeBlobSizing(e);
          }}
          onFocus={() => setActiveCodeId(codeId)}
          onKeyDown={handleKeyDown}
          ref={activeCodeId === codeId ? activeCodeRef : null} // attach ref only to active code
          className="bg-transparent border-none outline-none"
        />
        {activeCodeId === codeId &&
          <button
            type="button"
            onClick={() => deleteCode(codeId)}
            className="pr-1.5 bg-transparent text-gray-500 hover:text-gray-800 cursor-pointer"
          >
            <XMarkIcon className="size-5" />
          </button>
        }
        {hasTrailingBreak && <br/>}
      </span>
    );
  }; 

  const handleCodeBlobSizing = (e) => {
    const target = e.target;
    target.style.width = "1px";
    target.style.width = `${target.scrollWidth + 4}px`;
  }

  const renderPassage = (p) => {
    // If the passage ends with a line break, a line break should be added after the last code blob
    const endsWithLineBreak = p.text.endsWith("\n");

    return (
      <span key={p.position}>
        <span
          key={p.position}
          id={p.position}
          onClick={() => setActiveCodeId(p.codeIds[0])}
          className={p.codeIds?.length > 0 ? "bg-tertiaryContainer hover:bg-tertiaryContainerHover cursor-pointer rounded-sm px-1 w-fit mr-1" : ""}
        >
          {p.text}
        </span>
        {p.codeIds?.length > 0 && p.codeIds.map((codeId) => {
          return renderCodeBlob(codeId, endsWithLineBreak);
        })}
      </span>
    );
  }

  const renderCodeBookContents = () => {
    // Create a Set from codes to remove duplicates. Do not include the code that is currently being edited
    const uniqueCodes = new Set(codes.map(c => c.code).filter(c => c.trim() !== ""));
    // Map the unique items the list items of an unordered list
    return (
      <div className="flex flex-col w-full gap-2 px-6 py-4">
        {[...uniqueCodes].map(code => (
          <div key={code} className="flex justify-between items-center gap-10">
            <span>{code.trim()}</span>
            <span>{`(${codes.filter(c => c.code.trim() === code.trim()).length})`}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex w-full gap-7">
      <div onMouseUp={handleMouseUp} className="flex-1 rounded-xl border-1 border-outline p-8 text-onBackground text-base whitespace-pre-wrap">
        {passages.map((p) => (
          renderPassage(p)
        ))}
      </div>
      <div className="flex flex-col items-center w-fit h-fit min-w-50 max-w-sm sticky top-5 rounded-xl border-1 border-outline">
        <div className="flex h-fit w-full items-center justify-center px-4.5 pt-4 pb-3.5 border-b border-outline rounded-t-xl bg-container text-primary">
          <p className="text-lg font-semibold">Codebook</p>
        </div>
        {(codes.length === 0 || ((codes.length === 1) && codes[0].code === "")) && <p className="px-4.5 py-4 ">No codes yet</p>}
        {codes.some(c => c.code.trim() !== "") && renderCodeBookContents()}
      </div>
    </div>
  );
}

export default CodingCardContent;
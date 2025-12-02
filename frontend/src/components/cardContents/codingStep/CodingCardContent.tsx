import { useState, useContext, useEffect, useRef } from "react";
import { CodeId, Passage, PassageId, WorkflowContext } from "../../../context/WorkflowContext";
import Codebook from "./Codebook";
import CodeBlob from "./CodeBlob";
import { usePassageSegmenter } from "./hooks/usePassageSegmenter";
import SuggestionBlob from "./SuggestionBlob";
import { useSuggestionsManager } from "./hooks/useSuggestionsManager";
import InfoBox from "../../InfoBox";
import { useCodeManager } from "./hooks/useCodeManager";
import CodingSettingsCard from "./CodingSettingsCard";

const CodingCardContent = () => {
  // Get global states and setters from the context
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("WorkflowContext must be used within a WorkflowProvider");
  }
  const {
    passages,
    passagesPerColumn,
    aiSuggestionsEnabled,
    activeCodeId,
    setActiveCodeId,
    uploadedFile,
    csvHeaders,
  } = context;

  // Custom hooks
  const suggestionsManager = useSuggestionsManager();
  const codeManager = useCodeManager({ setActiveCodeId });
  const passageSegmenter = usePassageSegmenter();

  // Extract needed functions and states from custom hooks
  const { isFetchingHighlightSuggestion, declineHighlightSuggestion, inclusivelyFetchHighlightSuggestionAfter } = suggestionsManager;
  const { createNewPassage } = passageSegmenter;

  // For CSV data: Determine column names based on csvHeaders state, defaulting to generic names if none are set
  const columnNames = uploadedFile?.type === "text/csv"
    ? csvHeaders && csvHeaders.length > 0
      ? csvHeaders
      : Array.from({ length: passagesPerColumn?.size ?? 0 }, (_, i) => `Column ${i + 1}`)
    : []; // For text files, no columns

  // Local states
  const [hoveredPassageId, setHoveredPassageId] = useState<PassageId | null>(null);
  const [showHighlightSuggestionFor, setShowHighlightSuggestionFor] = useState<PassageId | null>(null);
  const [pendingHighlightFetches, setPendingHighlightFetches] = useState<Array<PassageId>>([]);
  const [displayedColumn, setDisplayedColumn] = useState<string>(columnNames[0] || "");
  
  // Refs
  const clickedSuggestionsToggleRef = useRef<boolean>(false); // Track if the most recent click was on the suggestions toggle
  const isProcessingPendingRef = useRef<boolean>(false); // Used for preventing overlapping processing of the same queue head
  // Keep a stable ref to the latest fetch function to avoid effect re-trigger on identity changes
  const inclusiveFetchRef = useRef(inclusivelyFetchHighlightSuggestionAfter);
  
  /**
   * If the uploaded file is CSV file -> on change of displayedColumn, change the displayed passages accordingly 
   */
  useEffect(() => {
    if (uploadedFile?.type === "text/csv" && passagesPerColumn) {
      const columnIndex = columnNames.indexOf(displayedColumn);
      const passagesToDisplay = passagesPerColumn.get(columnIndex);
      if (passagesToDisplay) {
        context.setPassages(passagesToDisplay);
      }
    }
  }, [displayedColumn]);

  /**
   * Whenever passages state changes, and the file is CSV, ensure that the passages state
   * is updated in passagesPerColumn as well.
   */
  useEffect(() => {
    if (uploadedFile?.type === "text/csv" && passagesPerColumn) {
      const columnIndex = columnNames.indexOf(displayedColumn);
      passagesPerColumn.set(columnIndex, passages);
    }
  }, [passages]);

  /**
   * Update the highlight suggestion fetch function ref whenever it changes
   */  
  useEffect(() => {
    inclusiveFetchRef.current = inclusivelyFetchHighlightSuggestionAfter;
  }, [inclusivelyFetchHighlightSuggestionAfter]);

  /**
   * Whenever pendingHighlightFetch changes, trigger fetching highlight suggestion for that passage, if it is the latest request
   */
  useEffect(() => {
    if (pendingHighlightFetches.length === 0) return;

    // If a code is activated, there should not be any pending suggestion fetches.
    // Code entering will trigger the next suggestion fetch after code editing is done.
    if (activeCodeId) {
      setPendingHighlightFetches([]);
      return;
    }

    // Ensure we don't start another fetch while one is in flight for the same queue head
    if (isProcessingPendingRef.current) return;
    isProcessingPendingRef.current = true;

    const idToProcess = pendingHighlightFetches[0];
    if (!idToProcess || !passages.find(p => p.id === idToProcess)) {
      // Invalid passage id, or passage no longer exists -> skip
      setPendingHighlightFetches(prev => prev.slice(1));
      isProcessingPendingRef.current = false;
      return;
    }

    // Use the stable ref to avoid duplicate calls when the function identity changes after passages update
    inclusiveFetchRef.current(idToProcess).then((idWithSuggestion) => {
      // After processing, remove this id from the pending list
      setPendingHighlightFetches(prev => prev.slice(1));
      // If a valid suggestion was received, set it to show
      if (idWithSuggestion) {
        setShowHighlightSuggestionFor(idWithSuggestion);
      }
    }).finally(() => {
      isProcessingPendingRef.current = false;
    });

  }, [pendingHighlightFetches]);


  /* 
   * Handle Escape key to decline and tab key to accept suggestion if no code is being edited
   */
  useEffect(() => {
    const handleEscapeOrTab = async (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Tab") return;
      
      // Read current state at event time
      const currentSuggestionPassageId = showHighlightSuggestionFor;
      const currentActiveCodeId = activeCodeId;
      
      if (currentActiveCodeId === null && currentSuggestionPassageId) {
        e.preventDefault();
        if (e.key === "Tab") {
          handleAcceptSuggestion(currentSuggestionPassageId);
        }
        if (e.key === "Escape") {
          setShowHighlightSuggestionFor(null);
          const idWithSuggestion = await declineHighlightSuggestion(currentSuggestionPassageId);
          if (idWithSuggestion) setShowHighlightSuggestionFor(idWithSuggestion);
        }
      }
    };

    document.addEventListener("keydown", handleEscapeOrTab);
    return () => document.removeEventListener("keydown", handleEscapeOrTab);
  }, [showHighlightSuggestionFor, activeCodeId, declineHighlightSuggestion]);


  /* 
   * Handles resetting clickedSuggestionsToggleRef on clicks outside the toggle
   */
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      // Only reset if the click is not on the toggle switch
      if (!(e.target as Element).closest('.toggle-switch')) {
        clickedSuggestionsToggleRef.current = false;
      }
    };

    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);


  /**
   * Handles accepting a highlight suggestion.
   * @param passage - the passage for which to accept the suggestion
   */
  const handleAcceptSuggestion = (
    parentPassageId: PassageId
  ) => {
    const parentPassage = passages.find(p => p.id === parentPassageId);
    if (!parentPassage || !parentPassage.nextHighlightSuggestion) return;
    const suggestionText = parentPassage.nextHighlightSuggestion?.passage;
    const suggestionCodes = parentPassage.nextHighlightSuggestion?.codes;
    if (!suggestionText || !suggestionCodes || suggestionCodes.length === 0) return;

    const startIdx = parentPassage.nextHighlightSuggestion.startIndex;
    const endIdx = startIdx + suggestionText.length;

    // Hide suggestion so the passage DOM becomes a single text node again
    setShowHighlightSuggestionFor(null);

    // Use a timeout to ensure the DOM has updated before creating the range
    setTimeout(() => {
      const root = document.getElementById(parentPassage.id);
      const textNode = root?.firstChild as Text | null;

      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const range = document.createRange();
        range.setStart(textNode, startIdx);
        range.setEnd(textNode, endIdx);
        createNewPassage(range, suggestionCodes) ?? null;
      }
    }, 0);
  };

  const handleUserHighlight = (selection: Selection) => {
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    const parentElement = selection.anchorNode?.parentElement;
    if (!parentElement) return;
    const parentElementId = parentElement.id;
    if (!parentElementId) return;

    // If parent element id is a passage id, highlight is in a passage with no highlight suggestion showing -> proceed normally
    if (parentElementId.startsWith("passage-") && passages.find(p => p.id === parentElementId)) {
      createNewPassage(range);
    } else {
      // ELSE: parent element is part of a passage with a visible suggestion -> special handling
      const grandParentElement = parentElement.parentElement;
      if (!grandParentElement) return;
      // In this case, grandparent id contains the passage id, and parent id tells us was the highlight before or after the suggestion
      const grandParentElementId = grandParentElement.id;
      if (!grandParentElementId) return;

      if (parentElementId === "highlight-suggestion") return; // Do not allow highlighting the suggestion itself

      // Base case: selection is before suggestion so anchorOffset can be used directly
      let startIdxInFullPassage = selection.anchorOffset; 

      // Adjust start index if selection is after suggestion
      if (parentElementId === "after-suggestion") {
        const beforeLength = document.getElementById("before-suggestion")?.textContent.length ?? 0;
        const suggestionLength = document.getElementById("highlight-suggestion")?.textContent.length ?? 0;
        startIdxInFullPassage = beforeLength + suggestionLength + selection.anchorOffset;
      }
      const endIdxInFullPassage = startIdxInFullPassage + selection.toString().length;

      // Hide suggestion so the passage DOM becomes a single text node again
      setShowHighlightSuggestionFor(null);

      // Use setTimeout to allow setShowHighlightSuggestionFor to take effect before proceeding
      setTimeout(() => {
        // Recreate range after DOM update
        const rangeAfterDomUpdate = document.createRange();
        const root = document.getElementById(grandParentElementId);
        const textNode = root?.firstChild as Text | null;
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          rangeAfterDomUpdate.setStart(textNode, startIdxInFullPassage);
          rangeAfterDomUpdate.setEnd(textNode, endIdxInFullPassage);
        } else {
          console.warn("Text node not found in passage during user highlight handling.");
          return; // Fallback: do nothing if text node not found
        }
        createNewPassage(rangeAfterDomUpdate);
      }, 0);
    }
  };


  /** 
   * Renders the text content of a passage, with highlight suggestion set to show on hover if available.
   * @param p passage to render
   * @returns 
   */
  const renderPassageText = (p: Passage) => {
    const showSuggestion = 
      aiSuggestionsEnabled &&
      !p.isHighlighted && 
      !activeCodeId &&
      showHighlightSuggestionFor === p.id;

    if (!showSuggestion || !p.nextHighlightSuggestion || p.nextHighlightSuggestion.passage.trim().length === 0) return p.text;

    const suggestionText = p.nextHighlightSuggestion.passage;
    const startIdx = p.nextHighlightSuggestion.startIndex;

    const endIdx = startIdx + suggestionText.length;

    return (
      <>
        {showSuggestion && 
          <>
            <span id="before-suggestion">{p.text.slice(0, startIdx)}</span>
            <span 
              onClick={async (e) => {
                e.stopPropagation();
                handleAcceptSuggestion(p.id);
              }}
              className="inline"
            >
              <span id="highlight-suggestion" className="bg-gray-300 cursor-pointer select-none mr-1">
                {p.text.slice(startIdx, endIdx)}
              </span>
            </span>
            <SuggestionBlob 
              passage={p} 
              onClick={(e) => {
                e.stopPropagation();
                handleAcceptSuggestion(p.id);
              }}
            />
            <span id="after-suggestion">{p.text.slice(endIdx)}</span>
          </>
        }
      </>
    );
  };


  /**
   *
   * @param p - the passage to be rendered
   * @returns - the jsx code of the passage
   */
  const renderPassage = (p: Passage) => {  
    const dataIsCSVWithHeaders = uploadedFile?.type === "text/csv" && csvHeaders !== null && csvHeaders.length > 0;

    return (
      <div 
        key={p.id}
        onClick={(e) => {
          e.stopPropagation(); // Prevent triggering parent onMouseDown
          // If there is an ongoing highlight suggestion fetch, do nothing
          if (isProcessingPendingRef.current) return;
          if (!p.isHighlighted) {
            setActiveCodeId(null);
            setPendingHighlightFetches((prev) => {
              // Only add if not already pending
              if (!prev.includes(p.id)) {
                return [...prev, p.id];
              }
              return prev;
            });
          }
        }}
        onMouseEnter={() => setHoveredPassageId(p.id)}
        onMouseLeave={() => setHoveredPassageId(null)}
        className="inline"
      >
        <span>
          {p.order === 0 && (
            <span className="block my-6 w-full border-t border-outline"></span>
          )}
          <span
            id={p.id}
            className={`
              ${
                p.isHighlighted
                  ? "bg-tertiaryContainer rounded-sm w-fit mr-1 cursor-default"
                  : ""
              }
              ${
                (p.isHighlighted && p.codeIds.includes(activeCodeId as CodeId))
                  ? "bg-tertiaryContainerHover rounded-sm underline decoration-onBackground"
                  : ""
              }
              ${
                (dataIsCSVWithHeaders && p.order === 0) // If this is the first passage and data is from CSV with headers, make it bold
                ? "font-bold"
                : ""
              }
            `}
          >
            {renderPassageText(p)}
          </span>
          <span>
            {p.codeIds.length > 0 &&
              p.codeIds.map((codeId, index) => (
                <CodeBlob
                  key={codeId}
                  parentPassage={p}
                  codeId={codeId}
                  codeSuggestions={p.codeSuggestions}
                  autocompleteSuggestions={p.autocompleteSuggestions}
                  activeCodeId={activeCodeId}
                  setActiveCodeId={setActiveCodeId}
                  setPendingHighlightFetches={setPendingHighlightFetches}
                  clickedSuggestionsToggleRef={clickedSuggestionsToggleRef}
                  isLastCodeOfPassage={index === p.codeIds.length - 1}
                  codeManager={codeManager}
                  suggestionsManager={suggestionsManager}
                />  
              ))}
          </span>
          {p.text.trim().endsWith("\u001E") && (
            <span className="block my-6 w-full border-t border-outline"></span>
          )}
        </span>
      </div>
    );
  };


  const handleDisplayedColumnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDisplayedColumn(e.target.value);
  };


  return (
    <div className="flex w-full gap-7">
      <div
        onMouseUp={() => {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            handleUserHighlight(selection);
          }
        }}
        className="flex-1 rounded-lg border-1 border-outline py-6 px-8 text-onBackground text-base whitespace-pre-wrap"
      >
        <p>File: <i>{uploadedFile?.name}</i></p>
        {uploadedFile?.type === "text/csv" && 
          <div className="flex items-center gap-2 pt-2 min-w-0">
            <span className="whitespace-nowrap pr-2">Displayed column:</span>
            <select
              name="displayedColumn"
              aria-label="Displayed CSV column"
              className="bg-transparent border border-outline rounded-sm pl-1 min-w-[100px] max-w-[300px] w-full truncate"
              value={displayedColumn}
              onChange={handleDisplayedColumnChange}
            >
              {columnNames.map((colName, idx) => (
                <option key={colName + idx} value={colName}>
                  {colName}
                </option>
              ))}
            </select>
          </div>
        }
        {passages.map((p) => renderPassage(p))}
      </div>
      <div className="flex flex-col items-center gap-4 h-fit w-fit min-w-50 max-w-sm">
        <Codebook codeManager={codeManager} />
        <CodingSettingsCard clickedSuggestionsToggleRef={clickedSuggestionsToggleRef} />
        {isFetchingHighlightSuggestion && !activeCodeId && <InfoBox msg="Fetching highlight suggestion..." variant="loading"></InfoBox>}
      </div>
    </div>
  );
};

export default CodingCardContent;

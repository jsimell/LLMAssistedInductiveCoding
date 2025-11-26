import { useState, useContext, useEffect, useRef } from "react";
import { CodeId, Passage, PassageId, WorkflowContext } from "../../../context/WorkflowContext";
import ToggleSwitch from "../../ToggleSwitch";
import Codebook from "./Codebook";
import CodeBlob from "./CodeBlob";
import { usePassageSegmenter } from "./hooks/usePassageSegmenter";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/solid";
import SuggestionBlob from "./SuggestionBlob";
import { useSuggestionsManager } from "./hooks/useSuggestionsManager";
import InfoBox from "../../InfoBox";
import { useCodeManager } from "./hooks/useCodeManager";

const CodingCardContent = () => {
  // Get global states and setters from the context
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("WorkflowContext must be used within a WorkflowProvider");
  }
  const {
    passages,
    setProceedAvailable,
    aiSuggestionsEnabled,
    setAiSuggestionsEnabled,
    contextWindowSize,
    setContextWindowSize,
    activeCodeId,
    setActiveCodeId,
    codingGuidelines,
    setCodingGuidelines,
  } = context;


  // Local state for tracking the currently hovered passage (only for visual purposes)
  const [hoveredPassageId, setHoveredPassageId] = useState<PassageId | null>(null);
  const [showHighlightSuggestionFor, setShowHighlightSuggestionFor] = useState<PassageId | null>(null);
  const [pendingHighlightFetches, setPendingHighlightFetches] = useState<Array<PassageId>>([]);
  
  // Refs
  const clickedSuggestionsToggleRef = useRef<boolean>(false); // Track if the most recent click was on the suggestions toggle


  // Custom hooks
  const suggestionsManager = useSuggestionsManager();
  const codeManager = useCodeManager({ setActiveCodeId });
  const passageSegmenter = usePassageSegmenter();

  // Extract needed functions and states from custom hooks
  const { isFetchingHighlightSuggestion, declineHighlightSuggestion, inclusivelyFetchHighlightSuggestionAfter } = suggestionsManager;
  const { createNewPassage } = passageSegmenter;


  // Whenever pendingHighlightFetch changes, trigger fetching highlight suggestion for that passage, if it is the latest request
  useEffect(() => {
    if (pendingHighlightFetches.length === 0) return;

    // If a code is activated, there should not be any pending suggestion fetches.
    // Code entering will trigger the next suggestion fetch after code editing is done.
    if (activeCodeId) {
      setPendingHighlightFetches([]);
      return;
    }

    const idToProcess = pendingHighlightFetches[0];
    if (!idToProcess || !passages.find(p => p.id === idToProcess)) {
      // Invalid passage id, or passage no longer exists -> skip
      setPendingHighlightFetches(prev => prev.slice(1));
      return;
    }

    inclusivelyFetchHighlightSuggestionAfter(idToProcess).then((idWithSuggestion) => {
      // After processing, remove this id from the pending list
      setPendingHighlightFetches(prev => prev.slice(1));
      // If a valid suggestion was received, set it to show
      if (idWithSuggestion) {
        setShowHighlightSuggestionFor(idWithSuggestion);
      }
    });

  }, [pendingHighlightFetches, inclusivelyFetchHighlightSuggestionAfter]);


  // Handle Escape key to decline and tab key to accept suggestion if no code is being edited
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
          await declineHighlightSuggestion(currentSuggestionPassageId);
          setShowHighlightSuggestionFor(currentSuggestionPassageId);
        }
      }
    };

    document.addEventListener("keydown", handleEscapeOrTab);
    return () => document.removeEventListener("keydown", handleEscapeOrTab);
  }, [showHighlightSuggestionFor, activeCodeId, declineHighlightSuggestion]);


  // Handles resetting clickedSuggestionsToggleRef on clicks outside the toggle
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
    if (!parentPassage) return;
    const suggestionText = parentPassage.nextHighlightSuggestion?.passage;
    if (!suggestionText) return;
    const suggestionCodes = parentPassage.nextHighlightSuggestion?.codes;
    if (!suggestionCodes || suggestionCodes.length === 0) return;

    const startIdx = parentPassage.text.indexOf(suggestionText);
    if (startIdx === -1) return;
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

    if (!showSuggestion || !p.nextHighlightSuggestion) return p.text;

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
    return (
      <div 
        key={p.id}
        onClick={(e) => {
          e.stopPropagation(); // Prevent triggering parent onMouseDown
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
        </span>
      </div>
    );
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
        className="flex-1 rounded-xl border-1 border-outline p-8 text-onBackground text-base whitespace-pre-wrap"
      >
        {passages.map((p) => renderPassage(p))}
      </div>
      <div className="flex flex-col items-center gap-4 sticky top-5 h-fit w-fit min-w-50 max-w-sm">
        <Codebook codeManager={codeManager} />
        <div className="flex flex-col gap-3 items-center justify-center rounded-xl border-1 border-outline p-6 mb-4">
          <div 
            className="flex gap-2 w-full items-center justify-between"
          >
            <p>AI suggestions</p>
            <ToggleSwitch
              booleanState={aiSuggestionsEnabled}
              setBooleanState={setAiSuggestionsEnabled}
              onMouseDown={() => {
                clickedSuggestionsToggleRef.current = true;
              }}
            />
          </div>
          <div className="flex gap-2 items-center justify-between">
            <div className="flex gap-1 items-center">
              <p>Context window for code suggestions (characters):</p>
              <div>
                <QuestionMarkCircleIcon
                  className="size-4.5 text-tertiary"
                  title="Approximate number of characters the prompt will include when generating code suggestions for a highlighted passage. The window is cut intelligently (e.g., at a line break), so the final context length may differ slightly. A value of 0 means only the highlighted passage is included in the prompt. &#10;&#10;Larger windows may improve suggestion relevance but increase response time and cost. Recommended values are between 200 and 1000."
                />
              </div>
            </div>
            <input
              type="number"
              value={contextWindowSize ?? ""}
              onChange={(e) =>
                setContextWindowSize(
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
              onBlur={(e) => {
                if (e.target.value === "" || e.target.value === null) {
                  setContextWindowSize(0); // Set to minimum value if input is empty
                }
              }}
              onKeyDown={(e) => {
                e.key === "Enter" && (e.target as HTMLInputElement).blur();
              }}
              className="border-1 border-outline rounded-md p-1 max-w-[80px]"
            />
          </div>
          <div className="flex flex-col w-full">
            <label htmlFor="codingGuidelines">Coding guidelines for the LLM:</label>
            <textarea
              id="codingGuidelines"
              value={codingGuidelines}
              onChange={(e) => setCodingGuidelines(e.target.value)}
              className="border-1 border-outline rounded-md p-1"
            />
          </div>
        </div>
        {isFetchingHighlightSuggestion && !activeCodeId && <InfoBox msg="Fetching highlight suggestion..." icon={null} variant="loading"></InfoBox>}
      </div>
    </div>
  );
};

export default CodingCardContent;

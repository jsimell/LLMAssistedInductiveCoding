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
    showHighlightSuggestionFor,
    setShowHighlightSuggestionFor,
    activeCodeId,
    setActiveCodeId,
  } = context;

  // Local state for tracking the currently active passage and code input
  const [activeHighlightedPassageId, setActiveHighlightedPassageId] = useState<PassageId | null>(null);
  const [hoveredPassageId, setHoveredPassageId] = useState<PassageId | null>(null);
  const [latestHighlightedPassageId, setLatestHighlightedPassageId] = useState<PassageId | null>(null);

  const { createNewPassage } = usePassageSegmenter();
  const { declineHighlightSuggestion, fetchingHighlightSuggestion } = useSuggestionsManager();

  const activeCodeRef = useRef<HTMLSpanElement>(null);
  const clickedSuggestionsToggleRef = useRef<boolean>(false); // Track if the most recent click was on the suggestions toggle

  // Moving to the next step should be allowed by default in this step
  useEffect(() => {
    setProceedAvailable(true);
  }, []);

  // Effect hook to keep activePassageId in sync with activeCodeId
  useEffect(() => {
    if (activeCodeId === null) {
      setActiveHighlightedPassageId(null);
      return;
    } else {
      const activePassage = context.codes.find(
        (c) => c.id === activeCodeId
      )?.passageId;
      setActiveHighlightedPassageId(activePassage !== undefined ? activePassage : null);
    }
  }, [activeCodeId]);

  // The purpose of the below is:
  // 1. ensure that the active code automatically gets focus when it is first created
  // 2. ensure that the codebook gets updated when activeCodeId changes (i.e., when user clicks on a code blob, or outside to defocus)
  //    This removes the need to use the onBlur event on the editable span of the code blob.
  useEffect(() => {
    if (activeCodeRef.current) {
      activeCodeRef.current.focus();
    }
  }, [activeCodeId]);

  /* 
   * When a new passage is highlighted, highlight suggestions should be shown for 
   * the following uncoded passage (if it exists) 
   */
  useEffect(() => {
    if (!latestHighlightedPassageId) return;

    const highlightedPassage = passages.find(p => p.id === latestHighlightedPassageId);
    if (!highlightedPassage) return;
    
    // Highlight suggestion should be shown on the following passage (if it exists)
    // OR if the following passage is highlighted or very short (less than 5 chars), 
    // on the first uncoded passage after that.
    let nextPassageOrder = highlightedPassage.order + 1;
    let followingPassage = passages.find(p => p.order === nextPassageOrder);
    
    while (followingPassage && (followingPassage.isHighlighted || followingPassage.text.length < 5)) {
      nextPassageOrder += 1;
      followingPassage = passages.find(p => p.order === nextPassageOrder);
    }

    console.log("Setting showHighlightSuggestionFor to passage:", followingPassage ? followingPassage.text.slice(0, 20) + "..." : null);
    setShowHighlightSuggestionFor(followingPassage ? followingPassage.id : null); // Default to null if no suitable passage found

  }, [latestHighlightedPassageId]);

  // Handle Escape key to decline and tab key to accept suggestion if no code is being edited
  useEffect(() => {
    const handleEscapeOrTab = (e: KeyboardEvent) => {
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
          setTimeout(() => declineHighlightSuggestion(currentSuggestionPassageId), 0);
        }
      }
    };

    document.addEventListener("keydown", handleEscapeOrTab);
    return () => document.removeEventListener("keydown", handleEscapeOrTab);
  }, [showHighlightSuggestionFor, activeCodeId, declineHighlightSuggestion]);


  // AHandles resetting clickedSuggestionsToggleRef on clicks outside the toggle
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
   * Handles accepting a highlight suggestion when it is clicked.
   * @param passage - the passage for which to accept the suggestion
   */
  const handleAcceptSuggestion = (
    parentPassageId: PassageId
  ) => {
    const parentPassage = passages.find(p => p.id === parentPassageId);
    if (!parentPassage) return;
    const suggestionText = parentPassage.nextHighlightSuggestion?.passage;
    if (!suggestionText) return;

    const startIdx = parentPassage.text.indexOf(suggestionText);
    if (startIdx === -1) return;
    const endIdx = startIdx + suggestionText.length;

    // 1) Hide suggestion so the passage DOM becomes a single text node again
    setActiveHighlightedPassageId(null);
    setShowHighlightSuggestionFor(null);

    // 2) Use a timeout to ensure the DOM has updated before creating the range
    setTimeout(() => {
      const root = document.getElementById(parentPassage.id);
      const textNode = root?.firstChild as Text | null;
      let newPassageId: PassageId | null = null;

      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const range = document.createRange();
        range.setStart(textNode, startIdx);
        range.setEnd(textNode, endIdx);
        newPassageId = createNewPassage(range, [parentPassage.nextHighlightSuggestion!.code + "; "]) ?? null;
      } else {
        // Fallback: select full contents if text node not available
        if (root) {
          const range = document.createRange();
          range.selectNodeContents(root);
          newPassageId = createNewPassage(range) ?? null;
        }
      }
      setLatestHighlightedPassageId(prev => newPassageId ?? prev);
    }, 0);
  };

  const handleUserHighlight = (selection: Selection) => {
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    const parentElement = selection.anchorNode?.parentElement;
    if (!parentElement) return;
    const parentElementId = parentElement.id;

    // If parent element id is a passage id, highlight is in a passage with no highlight suggestion showing -> proceed normally
    if (passages.find(p => p.id === parentElementId)) {
      createNewPassage(range);
      return;
    } else { // ELSE parent element is part of a passage with a visible suggestion -> special handling
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

      // Set showHighlightSuggestionFor to null to hide suggestion before creating new passage
      setShowHighlightSuggestionFor(null);

      // Use setTimeout to ensure DOM updates before creating new passage
      setTimeout(() => {
        // Recreate range after DOM update
        const rangeAfterDomUpdate = document.createRange();
        // FINISH IMPLEMENT (use index obtained before setTimeout)
        const root = document.getElementById(grandParentElementId);
        const textNode = root?.firstChild as Text | null;
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          rangeAfterDomUpdate.setStart(textNode, startIdxInFullPassage);
          rangeAfterDomUpdate.setEnd(textNode, endIdxInFullPassage);
        } else {
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
      p.nextHighlightSuggestion && 
      p.nextHighlightSuggestion.passage.trim().length > 0 &&
      !activeCodeId &&
      showHighlightSuggestionFor === p.id;

    if (!showSuggestion || !p.nextHighlightSuggestion) return p.text;

    const suggestionText = p.nextHighlightSuggestion.passage;
    const startIdx = p.nextHighlightSuggestion.startIndex;

    const endIdx = startIdx + suggestionText.length;

    return (
      <>
        <span id="before-suggestion">{p.text.slice(0, startIdx)}</span>
        <span 
          onClick={(e) => {
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
            setShowHighlightSuggestionFor(p.id);
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
                activeHighlightedPassageId === p.id
                  ? "bg-tertiaryContainerHover underline decoration-onBackground"
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
                  activeCodeId={activeCodeId}
                  setActiveCodeId={setActiveCodeId}
                  setActiveHighlightedPassageId={setActiveHighlightedPassageId}
                  activeCodeRef={activeCodeRef}
                  clickedSuggestionsToggleRef={clickedSuggestionsToggleRef}
                  isLastCodeOfPassage={index === p.codeIds.length - 1}
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
        <Codebook />
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
          <div className="flex gap-4 items-center justify-between">
            <div className="flex gap-1 items-center">
              <p>Context window for code suggestions (characters):</p>
              <div>
                <QuestionMarkCircleIcon
                  className="size-4.5 text-tertiary"
                  title="The number of characters that the LLM will consider when suggesting codes for a highlighted passage. A larger context window may provide more relevant suggestions, but also increases response time."
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
        </div>
        {fetchingHighlightSuggestion && !activeCodeId && <InfoBox msg="Fetching highlight suggestion..." icon={null} variant="loading"></InfoBox>}
      </div>
    </div>
  );
};

export default CodingCardContent;

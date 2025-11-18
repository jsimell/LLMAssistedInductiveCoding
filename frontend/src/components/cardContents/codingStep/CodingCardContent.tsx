import { useState, useContext, useEffect, useRef } from "react";
import { Passage, PassageId, WorkflowContext } from "../../../context/WorkflowContext";
import ToggleSwitch from "../../ToggleSwitch";
import Codebook from "./Codebook";
import CodeBlob from "./CodeBlob";
import { usePassageSegmenter } from "./hooks/usePassageSegmenter";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/solid";
import SuggestionBlob from "./SuggestionBlob";
import { useSuggestionsManager } from "./hooks/useSuggestionsManager";

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
  const [activePassageId, setActivePassageId] = useState<PassageId | null>(null);
  const [hoveredPassageId, setHoveredPassageId] = useState<PassageId | null>(null);
  const [latestHighlightedPassageId, setLatestHighlightedPassageId] = useState<PassageId | null>(null);

  const { createNewPassage } = usePassageSegmenter();
  const { declineHighlightSuggestion } = useSuggestionsManager();

  const activeCodeRef = useRef<HTMLSpanElement>(null);

  // Moving to the next step should be allowed by default in this step
  useEffect(() => {
    setProceedAvailable(true);
  }, []);

  // Effect hook to keep activePassageId in sync with activeCodeId
  useEffect(() => {
    if (activeCodeId === null) {
      setActivePassageId(null);
      return;
    } else {
      const activePassage = context.codes.find(
        (c) => c.id === activeCodeId
      )?.passageId;
      setActivePassageId(activePassage !== undefined ? activePassage : null);
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


  /**
   *
   * @param p - the passage to be rendered
   * @returns - the jsx code of the passage
   */
  const renderPassage = (p: Passage) => {
    return (
      <div 
        key={p.id}
        onClick={() => {
          if (!p.isHighlighted && p.nextHighlightSuggestion === null) {
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
                  ? "bg-tertiaryContainer rounded-sm px-1 w-fit mr-1 cursor-default"
                  : ""
              }
              ${
                activePassageId === p.id
                  ? "bg-tertiaryContainerHover underline decoration-onBackground"
                  : ""
              }
            `}
          >
            {renderPassageText(p)}
          </span>
          <span>
            {p.codeIds?.length > 0 &&
              p.codeIds.map((codeId) => (
                <CodeBlob
                  key={codeId}
                  parentPassage={p}
                  codeId={codeId}
                  activeCodeId={activeCodeId}
                  setActiveCodeId={setActiveCodeId}
                  setActivePassageId={setActivePassageId}
                  activeCodeRef={activeCodeRef}
                />  
              ))}
          </span>
        </span>
      </div>
    );
  };


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
    setActivePassageId(null);
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


  /** 
   * Renders the text content of a passage, with highlight suggestion set to show on hover if available.
   * @param p passage to render
   * @returns 
   */
  const renderPassageText = (p: Passage) => {
    const showSuggestion = 
      !p.isHighlighted && 
      p.nextHighlightSuggestion && 
      !activeCodeId &&
      showHighlightSuggestionFor === p.id;

    if (!showSuggestion) return p.text;

    const suggestionText = p.nextHighlightSuggestion!.passage;
    const startIdx = p.text.indexOf(suggestionText);
    
    if (startIdx === -1) return p.text;

    const endIdx = startIdx + suggestionText.length;

    return (
      <>
        {p.text.slice(0, startIdx)}
        <span 
          onClick={(e) => {
            e.stopPropagation();
            handleAcceptSuggestion(p.id);
          }}
          className="inline-block"
        >
          <span
            className="bg-gray-300 cursor-pointer select-none"
          >
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
        {p.text.slice(endIdx)}
      </>
    );
  };

  return (
    <div className="flex w-full gap-7">
      <div
        onMouseDown={() => setShowHighlightSuggestionFor(null)}
        onMouseUp={() => {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const newPassageId = createNewPassage(range);
            setLatestHighlightedPassageId(prev => newPassageId ?? prev);
          }
        }}
        className="flex-1 rounded-xl border-1 border-outline p-8 text-onBackground text-base whitespace-pre-wrap"
      >
        {passages.map((p) => renderPassage(p))}
      </div>
      <div className="flex flex-col items-center gap-4 sticky top-5 h-fit w-fit min-w-50 max-w-sm">
        <Codebook />
        <div className="flex flex-col gap-3 items-center justify-center rounded-xl border-1 border-outline p-6">
          <div className="flex gap-2 w-full items-center justify-between">
            <p>AI suggestions</p>
            <ToggleSwitch
              booleanState={aiSuggestionsEnabled}
              setBooleanState={setAiSuggestionsEnabled}
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
      </div>
    </div>
  );
};

export default CodingCardContent;

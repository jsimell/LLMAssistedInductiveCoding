import { useState, useContext, useEffect, useRef } from "react";
import { Passage, WorkflowContext } from "../../../context/WorkflowContext";
import ToggleSwitch from "../../ToggleSwitch";
import Codebook from "./Codebook";
import CodeBlob from "./CodeBlob";
import { usePassageSegmenter } from "./hooks/usePassageSegmenter";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/solid";
import { useCodeManager } from "./hooks/useCodeManager";
import SuggestionBlob from "./SuggestionBlob";

const CodingCardContent = () => {
  // Local state for tracking the currently active passage and code input
  const [activeCodeId, setActiveCodeId] = useState<number | null>(null);
  const [activePassageId, setActivePassageId] = useState<number | null>(null);
  const [hoveredPassageId, setHoveredPassageId] = useState<number | null>(null);

  const { createNewPassage } = usePassageSegmenter({
    setActiveCodeId,
  });

  const { addCode } = useCodeManager({ setActiveCodeId });

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
  } = context;

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
  const activeCodeRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (activeCodeRef.current) {
      activeCodeRef.current.focus();
    }
  }, [activeCodeId]);

  /**
   *
   * @param p - the passage to be rendered
   * @returns - the jsx code of the passage
   */
  const renderPassage = (p: Passage) => {
    // If the passage ends with a line break, a line break should be added after the last code blob
    const endsWithLineBreak = p.text.endsWith("\n");

    return (
      <span 
        key={p.id}
        onMouseEnter={() => {
          if (activePassageId !== p.id) setHoveredPassageId(p.id);
        }}
        onMouseLeave={() => setHoveredPassageId(null)}
        className="inline-block"
      >
        <span>
          <span
            id={p.id.toString()}
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering parent onMouseUp event
              if (p.isHighlighted && p.codeIds.length > 0)
                setActiveCodeId(p.codeIds[p.codeIds.length - 1]);
            }}
            className={`
              ${
                p.isHighlighted
                  ? "bg-tertiaryContainer hover:bg-tertiaryContainerHover cursor-pointer rounded-sm px-1 w-fit mr-1 "
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
          <span 
            className="inline-flex items-center"
          >
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
      </span>
    );
  };

  /** Renders the text content of a passage, with highlight suggestion set to show on hover if available
   * 
   * @param p passage to render
   * @returns 
   */
  const renderPassageText = (p: Passage) => {
    if (p.isHighlighted || !p.nextHighlightSuggestion || hoveredPassageId !== p.id || activePassageId !== null) return p.text;

    const startIdx = p.text.indexOf(p.nextHighlightSuggestion.passage);
    const endIdx = startIdx + p.nextHighlightSuggestion.passage.length;
    if (startIdx === -1) return p.text; // Suggestion passage not found in the passage text
    
    return (
      <>
        {p.text.slice(0, startIdx)}
        <span className="bg-gray-300 cursor-pointer select-none mr-1"
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering parent onMouseUp event
            // TODO: Think of a way to use createNewPassage here. Issue is that createNewPassage relies on dom selection, which we don't have here.
          }}
        >
          {p.text.slice(startIdx, endIdx)}
        </span>
        <SuggestionBlob 
          passage={p} 
          onClick={() => {
            // TODO: Think of a way to use createNewPassage here. Issue is that createNewPassage relies on dom selection, which we don't have here.
          }}
        />
        {p.text.slice(endIdx)}
      </>
    )
  }

  return (
    <div className="flex w-full gap-7">
      <div
        onMouseUp={createNewPassage}
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
              <p>Context window size</p>
              <QuestionMarkCircleIcon
                className="size-4.5 text-tertiary"
                title="The number of characters that the LLM will consider when suggesting codes for a highlighted passage. A larger context window may provide more relevant suggestions, but also increases response time."
              />
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
                  setContextWindowSize(500); // Reset to default if input is empty
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

import { useState, useContext, useEffect, useRef, use } from "react";
import { Passage, WorkflowContext } from "../../../context/WorkflowContext";
import ToggleSwitch from "../../ToggleSwitch";
import Codebook from "./Codebook";
import CodeBlob from "./CodeBlob";
import { usePassageSegmenter } from "./hooks/usePassageSegmenter";
import { useFullSuggestions } from "./hooks/useFullSuggestions";

const CodingCardContent = () => {
  // Local state for tracking the currently active passage and code input
  const [activeCodeId, setActiveCodeId] = useState<number | null>(null);
  const [activePassageId, setActivePassageId] = useState<number | null>(null);

  const { createNewPassage } = usePassageSegmenter({
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
    setProceedAvailable,
    aiSuggestionsEnabled,
    setAiSuggestionsEnabled,
  } = context;


  // Moving to the next step should be allowed by default in this step
  useEffect(() => {
    setProceedAvailable(true);
  }, []);

  // Custom hook to keep activePassageId in sync with activeCodeId
  useEffect(() => {
    if (activeCodeId === null) {
      setActivePassageId(null);
      return;
    } else {
      const activePassage = context.codes.find((c) => c.id === activeCodeId)?.passageId;
      setActivePassageId(activePassage !== undefined ? activePassage : null);
    }
  }, [activeCodeId]);


  // The purpose of the below is:
  // 1. ensure that the active code automatically gets focus when it is first created
  // 2. ensure that the codebook gets updated when activeCodeId changes (i.e., when user clicks on a code blob, or outside to defocus)
  //    This removes the need to use the onBlur event on the input of the code blob.
  const activeCodeRef = useRef<HTMLInputElement>(null);
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
      <span key={p.id}>
        <span
          id={p.id.toString()}
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering parent onMouseUp event
            if (p.codeIds?.length > 0) setActiveCodeId(p.codeIds[0]);
          }}
          className={`
            ${
              p.codeIds?.length > 0
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
          {p.text}
        </span>
        {p.codeIds?.length > 0 &&
          p.codeIds.map((codeId) => (
            <CodeBlob
              key={codeId}
              codeId={codeId}
              hasTrailingBreak={endsWithLineBreak}
              activeCodeId={activeCodeId}
              setActiveCodeId={setActiveCodeId}
              activeCodeRef={activeCodeRef}
            />
          ))}
      </span>
    );
  };

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

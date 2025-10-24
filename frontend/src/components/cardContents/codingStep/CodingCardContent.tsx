import { useState, useContext, useEffect, useRef, ChangeEvent } from "react";
import { Passage, WorkflowContext } from "../../../context/WorkflowContext";
import ToggleSwitch from "../../ToggleSwitch";
import Codebook from "./Codebook";
import CodeBlob from "./CodeBlob";
import { usePassageSegmenter } from "./usePassageSegmenter";

const CodingCardContent = () => {
  // Local state for tracking the currently active code input
  const [activeCodeId, setActiveCodeId] = useState<number | null>(null);

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
        onMouseUp={createNewPassage}
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

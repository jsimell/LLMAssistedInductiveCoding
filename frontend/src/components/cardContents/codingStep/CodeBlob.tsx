import { useContext } from "react";
import { WorkflowContext } from "../../../context/WorkflowContext";
import { useCodeManager } from "./useCodeManager";
import { XMarkIcon } from "@heroicons/react/24/solid";

interface CodeBlobProps {
  codeId: number;
  hasTrailingBreak: boolean;
  activeCodeId: number | null;
  setActiveCodeId: React.Dispatch<React.SetStateAction<number | null>>;
  activeCodeRef: React.RefObject<HTMLInputElement | null>;
}

const CodeBlob = ({
  codeId,
  hasTrailingBreak,
  activeCodeId,
  setActiveCodeId,
  activeCodeRef,
}: CodeBlobProps) => {
  
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("WorkflowContext must be used within a WorkflowProvider");
  }
  const { codes } = context;

  const codeObject = codes.find((c) => c.id === codeId);
  if (!codeObject) return null;

  const { deleteCode, updateCode, handleKeyDown } = useCodeManager({
    activeCodeId,
    setActiveCodeId,
  });

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

export default CodeBlob;

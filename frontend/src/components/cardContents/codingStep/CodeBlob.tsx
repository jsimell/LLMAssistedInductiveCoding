import { useState, useContext, useEffect, useRef } from "react";
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
  const context = useContext(WorkflowContext)!; // Non-null assertion since parent already ensures WorkflowContext is provided
  const { codes, codebook } = context;

  const codeObject = codes.find((c) => c.id === codeId);
  if (!codeObject) return null;
  const [inputValue, setInputValue] = useState(codeObject.code);

  const { deleteCode, updateCode, handleKeyDown } = useCodeManager({
    activeCodeId,
    setActiveCodeId,
  });

  useEffect(() => setInputValue(codeObject.code), [codeObject.code]);

  // Ensure that code blob input widths adjust to their content when component mounts and when codebook gets updated
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!inputRef.current) return;
    const inputEl = inputRef.current;
    if (inputEl.value === "") {
      const placeholderText = inputEl.getAttribute("placeholder") || "";
      inputEl.style.width = `${placeholderText.length - 2}ch`;
    } else {
      inputEl.style.width = "1px";
      inputEl.style.width = `${inputEl.scrollWidth + 4}px`;
    }
  }, [codebook]);

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
      className={`inline-flex items-center w-fit px-2 mr-1 bg-tertiaryContainer border border-gray-500 rounded-full hover:bg-tertiaryContainerHover focus:bg-tertiaryContainerHover focus:outline-none focus:ring-1 focus:ring-onBackground`}
    >
      <input
        value={inputValue}
        size={Math.max(codeObject.code.length + 1, 8)}
        placeholder="Type code..."
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          setInputValue(e.currentTarget.value);
          handleCodeBlobSizing(e);
        }}
        onFocus={() => setActiveCodeId(codeId)}
        onBlur={(e) => {
          // Basically same as pressing Enter: finalize editing
          updateCode(codeId, e.currentTarget.value);
          setActiveCodeId(null);
        }}
        onKeyDown={(e) => handleKeyDown(e)}
        ref={(el) => {
          inputRef.current = el; // By default, assign to inputRef
          if (activeCodeId === codeId) {
            // If the code blob is active, assign to activeCodeRef. This ensures that the input gets focused when it is first created
            activeCodeRef.current = el;
          }
        }}
        className="bg-transparent border-none outline-none"
      />
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault(); // Prevent input from losing focus
        }}
        onClick={() => deleteCode(codeId)}
        className="bg-transparent text-gray-500 rounded-full hover:text-gray-800 hover:bg-onBackground/10 cursor-pointer"
      >
        <XMarkIcon className="size-5" />
      </button>
      {hasTrailingBreak && <br />}
    </span>
  );
};

export default CodeBlob;

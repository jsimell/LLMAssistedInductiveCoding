import { PencilSquareIcon } from "@heroicons/react/24/solid";
import { useContext, useEffect, useRef, useState } from "react";
import { WorkflowContext } from "../../../context/WorkflowContext";
import { useCodeManager } from "./hooks/useCodeManager.js";
import SmallButton from "../../SmallButton.jsx";

interface CodeBookRowProps {
  code: string;
}

const CodeBookRow = ({ code }: CodeBookRowProps) => {
  if (!code.trim()) return null;

  const { codes } = useContext(WorkflowContext)!; // Non-null assertion since parent already ensures WorkflowContext is provided

  const [editInputValue, setEditInputValue] = useState(code);
  const [showEditInteraction, setShowEditInteraction] = useState(false);
  const editContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { editAllInstancesOfCode } = useCodeManager({
    setActiveCodeId: () => {},
  }); // Dummy setters since we don't need them here

  // Auto-grow textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      autoGrowTextArea(textareaRef.current);
    }
  }, [editInputValue]);

  // Adjust once when editor first appears (fixes initial oversize)
  useEffect(() => {
    if (showEditInteraction && textareaRef.current) {
      requestAnimationFrame(() => autoGrowTextArea(textareaRef.current!));
    }
  }, [showEditInteraction]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      saveChanges();
    } else if (e.key === "Escape") {
      cancelChanges();
    }
  };

  const saveChanges = () => {
    editAllInstancesOfCode(code, editInputValue);
    setShowEditInteraction(false);
  };

  const cancelChanges = () => {
    setEditInputValue(code); // Reset to original code
    setShowEditInteraction(false);
  };

  const autoGrowTextArea = (el: HTMLTextAreaElement) => {
    el.style.height = "0px"; // reset height
    const newHeight = el.scrollHeight;
    el.style.height = newHeight + 4 + "px"; // + 4 because of padding in the textarea
  };

  const renderEditInteraction = () => {
    return (
      <div ref={editContainerRef} className="flex flex-col mt-3.5 w-full bg-gray-200 border border-outline px-3.5 pt-2.5 pb-3 rounded-md">
        <span className="ml-[1px]">Edit all instances of code:</span>
        <div className="inline-flex gap-10 items-center justify-between pb-2 ml-[1px]">
          <i>{code}</i>
          <span>{`(${
            codes.filter((c) => (c.code ?? "").trim() === code.trim()).length
          })`}</span>
        </div>
        <span className="ml-[1px]">New value:</span>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={editInputValue}
            onChange={(e) => setEditInputValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e)}
            className="border border-gray-500 bg-background rounded-sm px-1 py-0.5 w-full resize-none overflow-hidden focus:outline-none focus:border-tertiary focus:border-2"
            onBlur={(e) => {
            // Defer to let focus move to the next element (e.g., Save/Cancel)
            setTimeout(() => {
              const next = document.activeElement;
              const leftEditor = next ? !editContainerRef.current?.contains(next) : true;

              if (!leftEditor) return; // Focus stayed inside editor (e.g., Save button)

              if (editInputValue.trim() === code.trim()) {
                setShowEditInteraction(false); // unchanged -> close
              } else {
                alert("You have unsaved changes in the codebook. Please Save or Cancel before continuing.");
                // keep editor open
              }
            }, 0);
          }}
            autoFocus
          />
        </div>
        <div className="flex gap-1.5 mt-3 justify-between">
          <SmallButton onClick={cancelChanges} label="Cancel" variant="outlineTertiary" title="Cancel editing" />
          <SmallButton onClick={saveChanges} label="Save" variant="tertiary" title="Save changes"/>
        </div>
      </div>
    );
  }

  return (
    <div
      key={code}
      className={`flex justify-between items-center gap-10 w-full ${
        showEditInteraction ? "flex rounded-lg mb-4" : ""
      }`}
    >
      {showEditInteraction ? (
        renderEditInteraction()
      ) : (
        <>
          <span className="flex items-center gap-1.5 py-1">
            {code.trim()}
            <PencilSquareIcon
              onClick={() => setShowEditInteraction(true)}
              className="w-6 h-6 p-0.5 flex-shrink-0 rounded-sm text-[#007a60] hover:bg-tertiary/10 cursor-pointer"
            />
          </span>
          <span>{`(${
            codes.filter((c) => (c.code ?? "").trim() === code.trim()).length
          })`}</span>
        </>
      )}
    </div>
  );
};

export default CodeBookRow;

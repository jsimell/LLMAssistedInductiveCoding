import { PencilSquareIcon } from "@heroicons/react/24/solid";
import { useContext, useEffect, useRef, useState } from "react";
import { WorkflowContext } from "../../../context/WorkflowContext";
import SmallButton from "../../SmallButton.jsx";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";

interface CodeBookRowProps {
  code: string;
  codeManager: {
    editAllInstancesOfCode: (oldValue: string, newValue: string) => void;
  };
  count: number;
  setShowCodeSummaryFor: React.Dispatch<React.SetStateAction<string | null>>;
}

const CodeBookRow = ({ code, codeManager, count, setShowCodeSummaryFor }: CodeBookRowProps) => {
  if (!code.trim()) return null;

  const { codes, setCodebook } = useContext(WorkflowContext)!; // Non-null assertion since parent already ensures WorkflowContext is provided

  const [editInputValue, setEditInputValue] = useState(code);
  const [showEditInteraction, setShowEditInteraction] = useState(false);
  const editContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Extract the required function from codeManager
  const { editAllInstancesOfCode } = codeManager; 

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
    const codeCount = codes.filter((c) => (c.code ?? "").trim() === code.trim()).length
    if (codeCount === 0) {
      // Simply update codebook
      setCodebook((prev) => {
        const updated = new Set(prev);
        updated.delete(code);
        if (editInputValue.trim().length > 0) {
          updated.add(editInputValue.trim());
        }
        return updated;
      });
    } else {
      // Edit all instances in codes state
      editAllInstancesOfCode(code, editInputValue);
    }
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
      className={`flex justify-between items-center gap-2 w-full ${
        showEditInteraction ? "flex rounded-lg mb-4" : ""
      }`}
    >
      {showEditInteraction ? (
        renderEditInteraction()
      ) : (
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-2">
            <span>{`(${
              codes.filter((c) => (c.code ?? "").trim() === code.trim()).length
            })`}</span>
            <span>{code.trim()}</span>
          </div>
          <span className="flex items-center py-1">
            <PencilSquareIcon
              title="Edit all instances of code"
              onClick={() => setShowEditInteraction(true)}
              className="w-6 h-6 p-0.5 flex-shrink-0 rounded-sm text-[#007a60] hover:bg-tertiary/10 cursor-pointer"
            />
            {count > 0 &&
              <MagnifyingGlassIcon
                title="Show code summary"
                onClick={() => setShowCodeSummaryFor(code)}
                className="w-6 h-6 p-0.5 flex-shrink-0 rounded-sm text-[#03528f] hover:bg-primary/10 cursor-pointer stroke-3"
              />
            }
            {count === 0 && 
              <XMarkIcon 
                title="Delete unused code" 
                className="w-6 h-6 p-0.5 flex-shrink-0 rounded-full text-red-800 hover:bg-red-700/10 cursor-pointer stroke-3"
                onClick={() => {
                  setCodebook(prev => {
                    const newCodebook = new Set(prev);
                    newCodebook.delete(code);
                    return newCodebook;
                  })
                }}
                />
            }
          </span>
        </div>
      )}
    </div>
  );
};

export default CodeBookRow;

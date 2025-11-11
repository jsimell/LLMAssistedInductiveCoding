import { PencilSquareIcon } from "@heroicons/react/24/solid";
import { useContext, useRef, useState } from "react";
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

  const { editAllInstancesOfCode } = useCodeManager({
    setActiveCodeId: () => {},
  }); // Dummy setters since we don't need them here

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

  const renderEditInteraction = () => {
    return (
      <div ref={editContainerRef} className="flex flex-col w-full bg-gray-200 border border-outline px-3.5 pt-2.5 pb-3 rounded-md">
        <span className="ml-[1px]">Edit all instances of code:</span>
        <div className="inline-flex items-center justify-between pb-2 ml-[1px]">
          <i>{code}</i>
          <span>{`(${
            codes.filter((c) => (c.code ?? "").trim() === code.trim()).length
          })`}</span>
        </div>
        <span className="ml-[1px]">New value:</span>
        <div className="relative">
          <input
            type="text"
            value={editInputValue}
            onChange={(e) => setEditInputValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e)}
            className="border border-gray-500 bg-background rounded-sm pl-0.5 w-full h-fit focus:outline-none focus:border-tertiary focus:border-2"
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

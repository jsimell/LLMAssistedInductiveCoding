import { useState, useContext, useEffect, useRef } from "react";
import {
  Code,
  CodeId,
  Passage,
  PassageId,
  WorkflowContext,
} from "../../../context/WorkflowContext";
import { useCodeManager } from "./hooks/useCodeManager";
import { XMarkIcon } from "@heroicons/react/24/solid";

interface CodeBlobProps {
  codeId: CodeId;
  parentPassage: Passage;
  activeCodeId: CodeId | null;
  setActiveCodeId: React.Dispatch<React.SetStateAction<CodeId | null>>;
  setActiveHighlightedPassageId: React.Dispatch<React.SetStateAction<PassageId | null>>;
  activeCodeRef: React.RefObject<HTMLSpanElement | null>;
  clickedSuggestionsToggleRef: React.RefObject<boolean>;
  isLastCodeOfPassage: boolean;
}

const CodeBlob = ({
  codeId,
  parentPassage,
  activeCodeId,
  setActiveCodeId,
  setActiveHighlightedPassageId,
  activeCodeRef,
  clickedSuggestionsToggleRef,
  isLastCodeOfPassage,
}: CodeBlobProps) => {

  // CONTEXT
  const context = useContext(WorkflowContext)!; // Non-null assertion since parent already ensures WorkflowContext is provided
  const { codes, aiSuggestionsEnabled } = context;

  // STATE
  const [ghostText, setGhostText] = useState<string>("Type code...");
  const codeObject = codes.find((c) => c.id === codeId);
  if (!codeObject) return null;
  const [inputValue, setInputValue] = useState(codeObject.code);
    
  // REFS
  const suggestionsDisabledRef = useRef<boolean>(false); // When user declines a ghost text suggestion, disable suggestions for this code edit session
  const changeIndexRef = useRef<number>(inputValue.length); // Track index where last change occurred inside contentEditable

  // CUSTOM HOOKS
  const { deleteCode, updateCode } = useCodeManager({
    setActiveCodeId,
  });

  // EFFECTS
  // Sync inputValue with global codes state when codes change (e.g., due to editAllInstancesOfCode)
  useEffect(() => {
    const updatedCodeObject = codes.find((c) => c.id === codeId);
    if (updatedCodeObject) {
      setInputValue(updatedCodeObject.code);
    }
  }, [codes, codeId]);

  // Update ghost text based on input value and suggestions
  useEffect(() => {
    if (suggestionsDisabledRef.current || !aiSuggestionsEnabled) {
      inputValue.length === 0 ? setGhostText("Type code...") : setGhostText("");
      return;
    }

    const afterLastSemicolon = inputValue
      .slice(inputValue.lastIndexOf(";") + 1)
      .trim();

    if (afterLastSemicolon === "") {
      // Nothing typed after last semicolon, or nothing typed at all
      // Find the first suggestion that hasn't been typed yet
      const inputValueLower = inputValue.toLowerCase();
      const existingCodesSet = new Set(codes.map(c => c.code.toLowerCase())); // Use a set for faster lookup

      const suggestion = parentPassage.codeSuggestions.find(suggestion => {
        const suggestionLower = suggestion.toLowerCase();
        const isNotInputted = !inputValueLower.includes(suggestionLower);
        const isNotAnExistingCode = !existingCodesSet.has(suggestionLower);
        return isNotInputted && isNotAnExistingCode;
      });
      if (suggestion) {
        setGhostText(suggestion);
      } else {
        inputValue === "" ? setGhostText("Type code...") : setGhostText("");
      }
    } else {
      // There is some text after the last semicolon, or the user has typed part of the first code
      const matchingSuggestion = parentPassage.autocompleteSuggestions.find(
        (suggestion) =>
          suggestion
            .toLowerCase()
            .startsWith(afterLastSemicolon.toLowerCase()) &&
          !inputValue.toLowerCase().includes(suggestion.toLowerCase())
      );
      setGhostText(
        matchingSuggestion?.slice(afterLastSemicolon.trim().length) || ""
      );
    }
  }, [activeCodeId, inputValue, parentPassage.codeSuggestions, parentPassage.autocompleteSuggestions, aiSuggestionsEnabled]);

  // Ensure correct cursor position after input value changes
  useEffect(() => {
    const changeIndex = changeIndexRef.current;
    if (activeCodeRef.current) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.setStart(activeCodeRef.current.childNodes[0] || activeCodeRef.current, changeIndex);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [inputValue]);

  /** 
   * 
   */
  const handleInputChange = (e: React.FormEvent<HTMLSpanElement>) => {
    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    
    if (range) {
      // Get cursor position relative to the contentEditable element
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(e.currentTarget);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      changeIndexRef.current = preCaretRange.toString().length;
      
      // Update input value state
      setInputValue(e.currentTarget.textContent || "");
    }
  }


  /**
   * Handles a keyboard event that occurs during code editing.
   * @param e - the keyboard event that triggered the function call
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (activeCodeId === null) return;
    if (!e.currentTarget) return;

    // ENTER: finalize editing of the current code
    if (e.key === "Enter") {
      e.preventDefault();
      clickedSuggestionsToggleRef.current = false;
      activeCodeRef.current?.blur(); // Blur to trigger handleCodeEnter
      return;
    }

    // TAB: accept code suggestion (if any)
    if (e.key === "Tab") {
      e.preventDefault();
      if (ghostText && ghostText !== "Type code...") {
        setInputValue(inputValue + ghostText + "; ");
        setGhostText(""); // Clear ghost text after accepting
        setTimeout(moveInputCursorToEnd, 0); // Move cursor to end after DOM update
        return;
      }
    }

    // ESCAPE: decline AI suggestion (if any) and keep editing, OR finalize editing if no suggestion
    if (e.key === "Escape") {
      if (ghostText && ghostText !== "Type code...") {
        e.preventDefault();
        suggestionsDisabledRef.current = true;
        return;
      } else {
        e.preventDefault();
        activeCodeRef.current?.blur(); // Blur to trigger handleCodeEnter
        return;
      }
    }

    // DELETE: delete the current code
    if (e.key === "Delete") {
      e.preventDefault();
      deleteCode(activeCodeId);
    }
  };

  /** Updates the code into the global state. Fetches new autocomplete suggestions if the value changed */
  const handleCodeEnter = () => {
    if (activeCodeId === null) return; // For safety: should not happen
    if (clickedSuggestionsToggleRef.current) {
      // If code enter was caused by user clicking the suggestions toggle, refocus the code blob instead of updating the code
      if (activeCodeRef.current) {
        activeCodeRef.current.focus();
      }
      return;
    }
    clickedSuggestionsToggleRef.current = false;

    // Re-enable suggestions for next edit session
    suggestionsDisabledRef.current = false;

    const codeObject: Code | undefined = codes.find(
      (c) => c.id === activeCodeId
    );
    if (!codeObject) return;

    const cleanedInputValue = inputValue.trim().replace(/;+$/, ""); // Remove trailing semicolons
    
    if (cleanedInputValue === "") {
      // If user entered an empty code, delete it
      deleteCode(activeCodeId);
      setActiveCodeId(null);
      return;
    }
    
    setInputValue(cleanedInputValue);
    
    // Only update codes if the value actually changed
    if (cleanedInputValue !== codeObject.code) {
      updateCode(activeCodeId, cleanedInputValue);
    }
    
    setActiveCodeId(null); // Set activeCodeId to null at the end
    return;
  };


  /**
   * Moves the input cursor to the end of the contentEditable element 
  */
  const moveInputCursorToEnd = () => {
    if (!activeCodeRef.current) return;
    const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(activeCodeRef.current);
        range.collapse(false); // false = collapse to end
        selection?.removeAllRanges();
        selection?.addRange(range);
        changeIndexRef.current = inputValue.length; // Update the change index ref
  };


  return (
    <>
      <span
        className={`
          inline-flex items-center self-center w-fit pl-2 pr-1.5 mr-1 my-0.5
        bg-tertiaryContainer border-1 border-gray-400 rounded-full hover:bg-tertiaryContainerHover 
          ${
            activeCodeId === codeId
              ? "bg-tertiaryContainerHover outline-1 border border-onBackground outline-onBackground shadow-[0_0_0_2px_black]"
              : ""
          } 
        `}
        onClick={() => setActiveCodeId(codeId)}
      >
        <span
          ref={(el) => {
            if (activeCodeId === codeId) {
              activeCodeRef.current = el;
            }
          }}
          contentEditable={true}
          suppressContentEditableWarning={true}
          onInput={handleInputChange}
          onFocus={() => setActiveCodeId(codeId)}
          onBlur={handleCodeEnter} // blurring is essentially same as pressing enter
          onKeyDown={(e) => handleKeyDown(e)}
          className="bg-transparent outline-none whitespace-pre empty:before:content-['\200B']"
        >
          {inputValue}
        </span>
        {activeCodeId === codeId && !suggestionsDisabledRef.current && (
          <span 
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent blur event on contentEditable element
            }}
            onClick={() => {
              // Focus the contentEditable element when ghost text is clicked
              if (activeCodeRef.current) {
                activeCodeRef.current.focus();
                moveInputCursorToEnd();
              }
            }}
            className="text-gray-500"
          >
            {ghostText}
          </span>
        )}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent input from losing focus
          }}
          onClick={() => {
            deleteCode(codeId);
            setActiveHighlightedPassageId(null);
          }}
          className={`bg-transparent ml-1.5 rounded-full hover:text-gray-800 hover:bg-onBackground/10 cursor-pointer
            ${activeCodeId === codeId ? "text-gray-700" : "text-gray-600"}`}
        >
          <XMarkIcon className="size-5" />
        </button>
      </span>
      {isLastCodeOfPassage && parentPassage.text.endsWith("\n") && (<br />) /* Preserve trailing newlines after code blobs */}
    </>
  );
};

export default CodeBlob;

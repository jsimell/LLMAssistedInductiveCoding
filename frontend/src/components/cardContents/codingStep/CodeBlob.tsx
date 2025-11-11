import { useState, useContext, useEffect, useRef } from "react";
import {
  Code,
  Passage,
  WorkflowContext,
} from "../../../context/WorkflowContext";
import { useCodeManager } from "./hooks/useCodeManager";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { useCodeSuggestions } from "./hooks/apiCommunication/useCodeSuggestions";

interface CodeBlobProps {
  codeId: number;
  parentPassage: Passage;
  activeCodeId: number | null;
  setActiveCodeId: React.Dispatch<React.SetStateAction<number | null>>;
  setActivePassageId: React.Dispatch<React.SetStateAction<number | null>>;
  activeCodeRef: React.RefObject<HTMLSpanElement | null>;
}

const CodeBlob = ({
  codeId,
  parentPassage,
  activeCodeId,
  setActiveCodeId,
  setActivePassageId,
  activeCodeRef,
}: CodeBlobProps) => {

  // CONTEXT
  const context = useContext(WorkflowContext)!; // Non-null assertion since parent already ensures WorkflowContext is provided
  const { codes, codebook } = context;

  // STATE
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<
    string[]
  >(Array.from(codebook));
  const [ghostText, setGhostText] = useState<string>("Type code...");
  const codeObject = codes.find((c) => c.id === codeId);
  if (!codeObject) return null;
  const [inputValue, setInputValue] = useState(codeObject.code);
    useState<boolean>(false);
    
  // REFS
  const currentlyEnteredValueRef = useRef(inputValue);
  const suggestionsDisabledRef = useRef<boolean>(false); // When user declines a suggestion, temporarily disable further suggestions
  const isFetchingRef = useRef(false);

  // CUSTOM HOOKS
  const { deleteCode, updateCode } = useCodeManager({
    setActiveCodeId,
  });
  const { getAutocompleteSuggestions } = useCodeSuggestions();

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
    const afterLastSemicolon = inputValue
      .slice(inputValue.lastIndexOf(";") + 1)
      .trim();

    if (afterLastSemicolon === "") {
      // Nothing typed after last semicolon, or nothing typed at all
      // Find the first suggestion that hasn't been typed yet
      const suggestion = parentPassage.codeSuggestions.find(
        (suggestion) => {
          return !inputValue.toLowerCase().includes(suggestion.toLowerCase());
        }
      );
      if (suggestion) {
        setGhostText(suggestion);
      } else {
        inputValue === "" ? setGhostText("Type code...") : setGhostText("");
      }
    } else {
      // There is some text after the last semicolon, or the user has typed part of the first code
      const matchingSuggestion = autocompleteSuggestions.find(
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
  }, [inputValue, autocompleteSuggestions, parentPassage.codeSuggestions]);

  // Fetch autocomplete suggestions if this codeBlob is empty and becomes active
  useEffect(() => {
    if (activeCodeId !== codeId) return; // This effect should only run for the active code
    suggestionsDisabledRef.current = false;  // If suggestions were disabled before, re-enable them when code becomes active again

    const fetchSuggestions = async () => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      const existingCodes = parentPassage.codeIds.map((id) => {
        const codeObj = codes.find((c) => c.id === id);
        return codeObj ? codeObj.code : "";
      });
      const suggestions = await getAutocompleteSuggestions(
        parentPassage,
        existingCodes
      );
      setAutocompleteSuggestions([...suggestions, ...Array.from(codebook)]); // Include codebook codes as well
      isFetchingRef.current = false;
    };

    if (inputValue.trim().length === 0) fetchSuggestions();
  }, [activeCodeId]);

  // Ensure cursor is always at the end of the current input
  useEffect(() => {
    if (activeCodeId === codeId && activeCodeRef.current) {
      // Move cursor to end after inputValue updates
      const range = document.createRange();
      const sel = window.getSelection();

      if (activeCodeRef.current.firstChild) {
        const textNode = activeCodeRef.current.firstChild;
        const length = textNode.textContent?.length || 0;
        range.setStart(textNode, Math.min(length, inputValue.length));
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }, [inputValue, activeCodeId, codeId]);


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
      activeCodeRef.current?.blur(); // Blur to trigger handleCodeEnter
      return;
    }

    // TAB: accept code suggestion (if any)
    if (e.key === "Tab") {
      e.preventDefault();
      if (ghostText && ghostText !== "Type code...") {
        setInputValue(inputValue + ghostText + "; ");
        setGhostText(""); // Clear ghost text after accepting
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
    const codeObject: Code | undefined = codes.find(
      (c) => c.id === activeCodeId
    );
    if (!codeObject) return;

    // Check if value changed since last enter
    const valueChanged = currentlyEnteredValueRef.current !== inputValue;

    updateCode(activeCodeId, inputValue); // Updates global state

    // If value changed, fetch new suggestions for next time
    if (valueChanged) {
      currentlyEnteredValueRef.current = inputValue; // Update ref to current value

      // Fetch new suggestions after the code is finalized
      const fetchSuggestions = async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        const existingCodes = parentPassage.codeIds.map((id) => {
          const codeObj = codes.find((c) => c.id === id);
          return codeObj ? codeObj.code : "";
        });
        const suggestions = await getAutocompleteSuggestions(
          parentPassage,
          existingCodes
        );
        setAutocompleteSuggestions([...suggestions, ...Array.from(codebook)]);
        isFetchingRef.current = false;
      };
      console.log("Fetching new suggestions after code update...");
      fetchSuggestions();
    
    }
    
    setActiveCodeId(null); // Set activeCodeId to null at the end
    return;
  };

  return (
    <span
      className={`inline-flex items-center self-center w-fit px-2 mr-1 my-0.5
      bg-tertiaryContainer border-1 border-gray-400 rounded-full hover:bg-tertiaryContainerHover 
      ${
        activeCodeId === codeId
          ? "bg-tertiaryContainerHover outline-1 outline-onBackground shadow-[0_0_0_2px_black]"
          : ""
      } 
      focus:outline-none focus:ring-1 focus:ring-onBackground`}
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
        onInput={() => setInputValue(activeCodeRef.current?.textContent || "")}
        onFocus={() => setActiveCodeId(codeId)}
        onBlur={handleCodeEnter} // blurring is essentially same as pressing enter
        onKeyDown={(e) => handleKeyDown(e)}
        className="bg-transparent outline-none whitespace-pre empty:before:content-['\200B']"
      >
        {inputValue}
      </span>
      {activeCodeId === codeId && !suggestionsDisabledRef.current && (
        <span className="text-gray-500">{ghostText}</span>
      )}
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault(); // Prevent input from losing focus
        }}
        onClick={() => {
          deleteCode(codeId);
          setActivePassageId(null);
        }}
        className={`bg-transparent rounded-full hover:text-gray-800 hover:bg-onBackground/10 cursor-pointer
          ${activeCodeId === codeId ? "text-gray-700" : "text-gray-600"}`}
      >
        <XMarkIcon className="size-5" />
      </button>
    </span>
  );
};

export default CodeBlob;

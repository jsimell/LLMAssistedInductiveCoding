import { useState, useContext, useEffect, useRef } from "react";
import {
  Code,
  CodeId,
  Passage,
  PassageId,
  WorkflowContext,
} from "../../../context/WorkflowContext";
import { XMarkIcon } from "@heroicons/react/24/solid";

interface CodeBlobProps {
  codeId: CodeId;
  parentPassage: Passage;
  codeSuggestions: string[];
  autocompleteSuggestions: string[];
  activeCodeId: CodeId | null;
  setActiveCodeId: React.Dispatch<React.SetStateAction<CodeId | null>>;
  setPendingHighlightFetches: React.Dispatch<React.SetStateAction<Array<PassageId>>>;
  clickedSuggestionsToggleRef: React.RefObject<boolean>;
  clickedExampleBlobRef: React.RefObject<boolean>;
  isLastCodeOfPassage: boolean;
  codeManager: {
    updateCode: (cid: CodeId, newCodeValue: string) => PassageId | null;
    deleteCode: (id: CodeId) => PassageId | null;
    editAllInstancesOfCode: (oldValue: string, newValue: string) => void;
  };
  suggestionsManager: {
    updateSuggestionsForPassage: (id: `passage-${number}`) => Promise<void>;
    updateAutocompleteSuggestionsForPassage: (id: `passage-${number}`) => Promise<void>;
  };
}

const CodeBlob = ({
  codeId,
  parentPassage,
  codeSuggestions,
  autocompleteSuggestions,
  activeCodeId,
  setActiveCodeId,
  setPendingHighlightFetches,
  clickedSuggestionsToggleRef,
  clickedExampleBlobRef,
  isLastCodeOfPassage,
  codeManager,
  suggestionsManager,
}: CodeBlobProps) => {

  // Extract functions from the custom hooks passed via props
  const { updateSuggestionsForPassage, updateAutocompleteSuggestionsForPassage } = suggestionsManager;
  const { deleteCode, updateCode } = codeManager;

  // CONTEXT
  const context = useContext(WorkflowContext)!; // Non-null assertion since parent already ensures WorkflowContext is provided
  const { codes, passages, setPassages, aiSuggestionsEnabled } = context;

  // STATE
  const [ghostText, setGhostText] = useState<string>("Type code...");
  const codeObject = codes.find((c) => c.id === codeId);
  if (!codeObject) return null;
  const [inputValue, setInputValue] = useState(codeObject.code);
    
  // REFS
  const changeIndexRef = useRef<number>(inputValue.length); // Track index where last change occurred inside contentEditable
  const inputRef = useRef<HTMLSpanElement | null>(null);

  // EFFECTS
  // Active code blob should have focus
  useEffect(() => {
    if (activeCodeId === codeId && inputRef.current !== document.activeElement) {
      inputRef.current?.focus();
    }
  }, [activeCodeId]);

  // Fetch new code suggestions and autocomplete suggestions for the parent passage when code blob is activated.
  // EXCEPTION: skip code suggestions fetch on first render, if the code blob was created through a highlight suggestion,
  // because in that case the initial code suggestions are already provided.
  useEffect(() => {
    if (!aiSuggestionsEnabled) return;
    if (!activeCodeId) return;
    if (activeCodeId === codeId) {
      // Only fetch suggestions if AI suggestions are enabled
      if (aiSuggestionsEnabled) {
        // Update suggestions for the parent passage
        const fetchSuggestions = async () => {
          // On first render, there may already be initial code suggestions (if created from highlight suggestion)
          // In that case, only fetch autocomplete suggestions
          if (parentPassage.autocompleteSuggestions.length === 0 && parentPassage.codeSuggestions.length > 0) {
            // Only fetch autocomplete suggestions on first render if initial code suggestions exist
            await updateAutocompleteSuggestionsForPassage(parentPassage.id);
            return;
          } else {
            // On subsequent renders, fetch both code suggestions and autocomplete suggestions
            await updateSuggestionsForPassage(parentPassage.id);
          }
        };

        fetchSuggestions();
      }
    }
  }, [activeCodeId]);

  // Sync inputValue with global codes state when codes change (e.g., due to editAllInstancesOfCode)
  useEffect(() => {
    const updatedCodeObject = codes.find((c) => c.id === codeId);
    if (updatedCodeObject) {
      setInputValue(updatedCodeObject.code);
    }
  }, [codes]);

  // Update ghost text based on input value and suggestions
  useEffect(() => {
    if (!aiSuggestionsEnabled) {
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
      const existingCodesSet = new Set(codes.filter(c => c.passageId === parentPassage.id).map(c => c.code.toLowerCase()));

      const suggestion = codeSuggestions.find(s => {
        const suggestionLower = s.toLowerCase();
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
  }, [activeCodeId, inputValue, codeSuggestions, autocompleteSuggestions, aiSuggestionsEnabled]);

  // Ensure correct cursor position after input value changes
  useEffect(() => {
    const changeIndex = changeIndexRef.current;
    if (activeCodeId === codeId && inputRef.current) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.setStart(inputRef.current?.childNodes[0] || inputRef.current, changeIndex);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [inputValue]);

  // Ensure code input is defocused when activeCodeId changes to another code or null
  useEffect(() => {
    if (activeCodeId !== codeId) {
      inputRef.current?.blur();
    }
  }, [activeCodeId, codeId]);

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
      inputRef.current?.blur(); // Blur to trigger handleCodeEnter
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
        // Remove the suggested text from the passage's code and autocomplete suggestions
        const passage = passages.find(p => p.id === parentPassage.id);
        if (!passage) return;
        setPassages(prevPassages => prevPassages.map(p => {
          if (p.id === passage.id && p.isHighlighted) {
            return {
              ...p,
              codeSuggestions: p.codeSuggestions.filter(s => s !== ghostText),
              autocompleteSuggestions: p.autocompleteSuggestions.filter(s => s !== ghostText),
            };
          }
          return p;
        }));
        // And hide ghost text until user changes input again
        return;
      } else {
        e.preventDefault();
        inputRef.current?.blur(); // Blur to trigger handleCodeEnter
        return;
      }
    }

    // DELETE: delete the current code
    if (e.key === "Delete") {
      e.preventDefault();
      handleDeletion();
      return;
    }
  };

  /** Handles the deletion of a code, which may trigger highlight suggestion fetches.
   * 
   * @param codeId - the ID of the code to be deleted
   */
  const handleDeletion = () => {
    const queueForSuggestionFetch = (passages.find(p => p.id === parentPassage.id)?.codeIds.length ?? 0) <= 1;
    const affectedPassageId = deleteCode(codeId);
    if (affectedPassageId && queueForSuggestionFetch) {
      setPendingHighlightFetches(prev => [...prev, affectedPassageId]);
    }
  };


  /** Updates the code into the global state. */
  const handleCodeEnter = async () => {
    if (activeCodeId === null) return; // For safety: should not happen
    if (clickedSuggestionsToggleRef.current || clickedExampleBlobRef.current) {
      // If code enter was caused by user clicking the suggestions toggle or a few-shot example checkbox, 
      // refocus the code blob instead of updating the code
      inputRef.current?.focus();
      return;
    }
    clickedSuggestionsToggleRef.current = false;

    const codeObject: Code | undefined = codes.find(
      (c) => c.id === activeCodeId
    );
    if (!codeObject) return;

    const cleanedInputValue = inputValue.trim().replace(/;+$/, ""); // Remove trailing semicolons
    
    if (cleanedInputValue === "") {
      // If user entered an empty code, delete it
      handleDeletion();
      return;
    }
    
    setInputValue(cleanedInputValue);
    
    // Only update codes if the value actually changed
    if (cleanedInputValue !== codeObject.code) {
      const affectedPassageId = updateCode(activeCodeId, cleanedInputValue);
      setTimeout(() => {
        if (affectedPassageId) {
          setPendingHighlightFetches(prev => [...prev, affectedPassageId]);
        }
      }, 0);
    }

    setActiveCodeId(null); // Set activeCodeId to null at the end

    return;
  };


  /**
   * Moves the input cursor to the end of the contentEditable element 
  */
  const moveInputCursorToEnd = () => {
    if (!inputRef.current) return;
    const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(inputRef.current);
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
        onClick={(e) => setActiveCodeId(codeId)}
      >
        <div className="inline whitespace-pre-wrap">
          <span
            ref={inputRef}
            contentEditable={true}
            suppressContentEditableWarning={true}
            onInput={handleInputChange}
            onFocus={() => setActiveCodeId(codeId)}
            onBlur={handleCodeEnter} // blurring is essentially same as pressing enter
            onKeyDown={(e) => handleKeyDown(e)}
            className="bg-transparent outline-none whitespace-pre-wrap empty:before:content-['\200B']"
          >
            {inputValue}
          </span>
          {activeCodeId === codeId && (
            <span 
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur event on contentEditable element
              }}
              onClick={() => {
                // Focus the contentEditable element when ghost text is clicked
                inputRef.current?.focus();
                moveInputCursorToEnd();
              }}
              className="text-gray-500"
            >
              {ghostText}
            </span>
          )}
        </div>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent input from losing focus
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleDeletion();
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

import { useContext, useRef, useEffect } from "react";
import { Code, CodeId, Passage, PassageId, WorkflowContext } from "../../../../context/WorkflowContext";
import { useCodeSuggestions } from "./apiCommunication/useCodeSuggestions";
import { useHighlightSuggestions } from "./apiCommunication/useHighlightSuggestions";

interface UseCodeManagerProps {
  setActiveCodeId: React.Dispatch<React.SetStateAction<CodeId | null>>;
}

/**
 * Custom hook to manage data coding-related operations on existing codes, such as updating, deleting codes,
 * and handling keyboard events during code editing. Code creation is handled elsewhere.
 *
 * @param activeCodeId - The ID of the currently active code being edited.
 * @param setActiveCodeId - Function to update the active code ID.
 * @returns An object containing functions to update, delete codes, and handle keydown events.
 */
export const useCodeManager = ({
  setActiveCodeId,
}: UseCodeManagerProps) => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useCodeManager must be used within a WorkflowProvider");
  }

  const { codes, setCodes, passages, setPassages, nextCodeIdNumber, setNextCodeIdNumber } = context;
  const { getCodeSuggestions } = useCodeSuggestions();
  const { getNextHighlightSuggestion } = useHighlightSuggestions();

  // Track which passage needs suggestion update
  const fetchSuggestionsForPassageId = useRef<string | null>(null);

  // Update code suggestions for passages that need it when codes state changes
  useEffect(() => {
      const targetPassageId = fetchSuggestionsForPassageId.current;
      fetchSuggestionsForPassageId.current = null;
      
      const targetPassage = passages.find(p => p.id === targetPassageId);
      if (!targetPassage) return;

      if (targetPassage.isHighlighted) {
        const existingCodes = targetPassage.codeIds.map(
          (cid) => codes.find((c) => c.id === cid)?.code || ""
        ).filter(Boolean);
        getCodeSuggestions(targetPassage, existingCodes).then((suggestions) => {
          setPassages((prev) => {
            const currentPassage = prev.find(p => p.id === targetPassageId);
            // Only apply if passage still exists, is STILL highlighted and HAS codes
            if (!currentPassage || !currentPassage.isHighlighted || currentPassage.codeIds.length === 0) {
              return prev; // Passage state changed - ignore stale response
            }
            
            return prev.map((p) =>
              p.id === targetPassageId && p.isHighlighted
                ? { ...p, codeSuggestions: suggestions }
                : p
            );
          });
        })
        .catch((error) => {
          console.error(`Failed to fetch code suggestions for passage ${targetPassage.text.slice(0, 30)+ "..."}:`, error);
        });
      } else {
        // If passage is not highlighted, fetch highlight suggestions
        getNextHighlightSuggestion(targetPassage, 0).then((suggestion) => {
          const isHighlighted = passages.find(p => p.id === targetPassage.id)?.isHighlighted || false; // Use an uo-to-date value
          setPassages((prev) => {
            const currentPassage = prev.find(p => p.id === targetPassageId);
            // Only apply if passage still exists and is still unhighlighted
            if (!currentPassage || currentPassage.isHighlighted) {
              return prev; // Passage state changed - ignore stale response
            }
            
            return prev.map((p) =>
              p.id === targetPassageId && !p.isHighlighted
                ? { ...p, nextHighlightSuggestion: suggestion }
                : p
            );
          });
        })
        .catch((error) => {
          console.error(`Failed to fetch highlight suggestion for passage ${targetPassage.text.slice(0, 30)+ "..."}:`, error);
        });
      }
  }, [passages]);


  /**
   * Helper to check if two codeId arrays are equal
   */
  const areCodeIdsEqual = (ids1: number[], ids2: number[]): boolean => {
    if (ids1.length !== ids2.length) return false;
    return ids1.every((id, index) => id === ids2[index]);
  };


  /** Adds a new code to a passage and activates the added code.
   * 
   * @param passageId Id of the passage to which the code will be added
   * @param codeValue The code content (can be a single code or multiple codes separated by ';')
   */
  const addCode = (passage: Passage, codeValue: string) => {
    let codeList = separateMultipleCodes(codeValue.trim());
    // Edge case: if the codeValue is an empty string (i.e., user clicked the + button without typing anything)
    if (codeValue.trim() === "") {
      codeList = [""];
    }
    
    let newCodeIdNumber = nextCodeIdNumber; // Extract numeric part
    const getNextCodeId = () => {
      const id = `code-${newCodeIdNumber++}` as CodeId;
      return id;
    }

    setCodes((prev) => {
      const newCodes = codeList.map((code) => {
        const codeObj: Code = {
          id: getNextCodeId(),
          passageId: passage.id,
          code: code,
        };
        return codeObj;
      });
      return [...prev, ...newCodes];
    });

    // Update passage to include new code IDs
    const newCodeIds: CodeId[] = [];
    for (let i = 0; i < codeList.length; i++) {
      newCodeIds.push(getNextCodeId());
    }
    setPassages((prev) =>
      prev.map((p) =>
        p.id === passage.id
          ? { ...p, isHighlighted: true, codeIds: [...p.codeIds, ...newCodeIds], nextHighlightSuggestion: null }
          : p
      )
    );

    // Mark passage for AI suggestion update
    fetchSuggestionsForPassageId.current = passage.id;

    // Update nextCodeId
    setNextCodeIdNumber(newCodeIdNumber);

    // Set the last added code as active
    setActiveCodeId(newCodeIds[newCodeIds.length - 1]);
    return;
  };


  /** Updates the value of a specific code.
   * 
   * @param id - the id of the code to be updated
   * @param newValue - the new value of the code
   */
  const updateCode = (id: CodeId, newValue: string) => {
    const codeList = separateMultipleCodes(newValue.trim());

    let newCodeIdNumber = nextCodeIdNumber;
    const getNextCodeId = () => {
      const id = `code-${newCodeIdNumber++}` as CodeId;
      return id;
    }

    // Edge case: if no change, do nothing
    const existingCode = codes.find((c) => c.id === id);
    if (!existingCode) return;
    if (codeList.length === 1 && codeList[0] === existingCode.code) {
      return;
    }

    // Edge case: if user cleared the code completely (i.e. entered on an empty codeBlob), delete it instead
    if (codeList.length === 0) {
      deleteCode(id);
      return;
    }

    const codeObject = codes.find((c) => c.id === id);
    if (!codeObject) return;
    const passageId: PassageId = codeObject.passageId;

    // Collect new code IDs that will be created (only for codes beyond the first)
    const newCodeIds: CodeId[] = [];
    for (let i = 1; i < codeList.length; i++) {
      newCodeIds.push(getNextCodeId());
    }

    // Update the codes state
    setCodes((prev) => {
      const newCodes = prev.map((c) =>
        c.id === id ? { ...c, code: codeList[0] } : c
      );
      
      if (codeList.length > 1) {
        const additionalCodes = codeList.slice(1).map((code, index) => ({
          id: newCodeIds[index], // Use pre-allocated IDs
          passageId: passageId,
          code: code,
        }));
        return [...newCodes, ...additionalCodes];
      }
      return newCodes;
    });

    // Update passages to reflect new codeIds
    setPassages((prev) =>
      prev.map((p) => {
        return p.id === passageId
          ? {
              ...p,
              isHighlighted: true,
              codeIds: [...p.codeIds, ...newCodeIds],
              nextHighlightSuggestion: null,
            }
          : p;
      })
    );

    // Update nextCodeId
    setNextCodeIdNumber(newCodeIdNumber);

    // Mark passage for AI suggestion update
    fetchSuggestionsForPassageId.current = passageId;

    // No code should be active after update -> set activeCodeId to null
    setActiveCodeId(null);
    return;
  };

  /**
   * Deletes a code.
   * @param id - the id of the code to be deleted
   */
  const deleteCode = (id: CodeId) => {

    setPassages((prev) => {
      // 1. Find affected passage
      const affectedPassage = prev.find((p) => p.isHighlighted && p.codeIds.includes(id));
      if (!affectedPassage) return prev;

      // 2. Remove code from passage's codeIds
      const filteredCodeIds = affectedPassage.codeIds.filter((cid) => cid !== id);

      // 3. Check if passage still has codes and create properly typed passage
      let updatedPassage: Passage;
      if (filteredCodeIds.length > 0) {
        updatedPassage = {
          ...affectedPassage,
          isHighlighted: true,
          codeIds: filteredCodeIds,
          nextHighlightSuggestion: null,
        };
        // Mark the passage for AI suggestion update and return updated passages
        fetchSuggestionsForPassageId.current = updatedPassage.id;
        return prev.map((p) =>
          p.id === updatedPassage.id ? updatedPassage : p
        );
      } else {
        updatedPassage = {
          ...affectedPassage,
          isHighlighted: false,
          codeIds: [],
          codeSuggestions: [],
          nextHighlightSuggestion: null,
        };
      }

      // 5. Otherwise: passage has no codes left and it may have to be merged with neighboring passages.
      // Find the neighbors of the passage based on order, to check whether they are empty and can be merged
      const prevPassage = prev.find(
        (p) => p.order === updatedPassage.order - 1
      );
      const nextPassage = prev.find(
        (p) => p.order === updatedPassage.order + 1
      );
      const mergePrev = prevPassage && prevPassage.codeIds.length === 0;
      const mergeNext = nextPassage && nextPassage.codeIds.length === 0;

      // Determine merged text and which passages to remove from the passages state
      let mergedText = updatedPassage.text;
      let passagesToRemove = [updatedPassage.id];
      if (mergePrev) {
        mergedText = prevPassage.text + mergedText;
        passagesToRemove.push(prevPassage.id);
      }
      if (mergeNext) {
        mergedText = mergedText + nextPassage.text;
        passagesToRemove.push(nextPassage.id);
      }

      // Create a new merged passage (empty codeIds)
      const newMergedPassage: Passage = {
        id: updatedPassage.id, // reuse the current one’s id
        order: mergePrev ? prevPassage.order : updatedPassage.order,
        text: mergedText,
        isHighlighted: false,
        codeIds: [],
        codeSuggestions: [],
        nextHighlightSuggestion: null,
      };

      // Set passage needing update ref
      fetchSuggestionsForPassageId.current = newMergedPassage.id;

      // Insert the new merged passage and remove the old ones
      const filtered = prev.filter((p) => !passagesToRemove.includes(p.id));
      const inserted = [...filtered, newMergedPassage];
      const sorted = inserted.sort((a, b) => a.order - b.order);
      return sorted.map((p, i) => ({ ...p, order: i }));
    });

    // 6. Remove code from codes array
    setCodes((prev) => prev.filter((c) => c.id !== id));

    // 7. No code should be active after deletion -> set activeCodeId to null
    setActiveCodeId(null);
  };

  const editAllInstancesOfCode = (oldValue: string, newValue: string) => {
    const idsToEdit = codes.filter((c) => c.code === oldValue).map((c) => c.id);
    const newArray = codes.map((code) =>
      idsToEdit.includes(code.id) ? { ...code, code: newValue } : code
    );
    setCodes(newArray);
  };

  const separateMultipleCodes = (codeString: string) => {
    const codeList = codeString
      .split(";")
      .map((code) => code.trim())
      .filter(Boolean);
    return codeList;
  };

  return { addCode, updateCode, deleteCode, editAllInstancesOfCode };
};

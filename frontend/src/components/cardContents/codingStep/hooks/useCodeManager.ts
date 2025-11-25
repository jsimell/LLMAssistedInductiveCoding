import { useContext } from "react";
import { CodeId, Passage, PassageId, WorkflowContext } from "../../../../context/WorkflowContext";

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

  // Context values
  const { codes, setCodes, setPassages, nextCodeIdNumber, setNextCodeIdNumber, nextPassageIdNumber, setNextPassageIdNumber } = context;


  /** Updates the value of a specific code.
   * 
   * @param id - the id of the code to be updated
   * @param newValue - the new value of the code
   * @return The PassageId of the passage containing the updated code, or null if no update was made
   */
  const updateCode = (id: CodeId, newValue: string): PassageId | null => {
    const codeList = separateMultipleCodes(newValue.trim());

    let newCodeIdNumber = nextCodeIdNumber;
    const getNextCodeId = () => {
      const id = `code-${newCodeIdNumber++}` as CodeId;
      return id;
    }

    // Edge case: if no change, do nothing
    const existingCode = codes.find((c) => c.id === id);
    if (!existingCode) return null;
    if (codeList.length === 1 && codeList[0] === existingCode.code) {
      return null;
    }

    // Edge case: if user cleared the code completely (i.e. entered on an empty codeBlob), delete it instead
    if (codeList.length === 0) {
      return deleteCode(id);
    }

    const codeObject = codes.find((c) => c.id === id);
    if (!codeObject) return null;
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

    // No code should be active after update -> set activeCodeId to null
    setActiveCodeId(null);

    return passageId;
  };

  /**
   * Deletes a code.
   * @param id - the id of the code to be deleted
   */
  const deleteCode = (id: CodeId) => {
    let affectedPassageId: PassageId | null = null;
    let fetchHighlightSuggestion = true;

    setPassages((prev) => {
      // Find affected passage
      const affectedPassage = prev.find((p) => p.isHighlighted && p.codeIds.includes(id));
      if (!affectedPassage) return prev;
      affectedPassageId = affectedPassage.id;

      // Remove code from passage's codeIds
      const filteredCodeIds = affectedPassage.codeIds.filter((cid) => cid !== id);

      let updatedPassage: Passage;

      // If passage still has codes after deletion, just update its codeIds
      if (filteredCodeIds.length > 0) {
        updatedPassage = {
          ...affectedPassage,
          isHighlighted: true,
          codeIds: filteredCodeIds,
          nextHighlightSuggestion: null,
        };
        fetchHighlightSuggestion = false; // If passage still has codes, no need to fetch highlight suggestion later
        return prev.map((p) =>
          p.id === affectedPassageId ? updatedPassage : p
        );
      }

      // Passage has no codes left and it may have to be merged with neighboring passages.
      // Find the neighbors of the passage based on order, to check whether they are empty and can be merged
      updatedPassage = {
        ...affectedPassage,
        isHighlighted: false,
        codeIds: [],
        codeSuggestions: [],
        autocompleteSuggestions: [],
        nextHighlightSuggestion: null,
      };
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
      let passagesToRemove = [affectedPassageId];
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
        id: affectedPassageId, // reuse the current one’s id
        order: mergePrev ? prevPassage.order : updatedPassage.order,
        text: mergedText,
        isHighlighted: false,
        codeIds: [],
        codeSuggestions: [],
        autocompleteSuggestions: [],
        nextHighlightSuggestion: null,
      };

      // Insert the new merged passage and remove the old ones
      const filtered = prev.filter((p) => !passagesToRemove.includes(p.id));
      const inserted = [...filtered, newMergedPassage];
      const sorted = inserted.sort((a, b) => a.order - b.order);
      const reIndexed = sorted.map((p, i) => ({ ...p, order: i }));
      return reIndexed;
    });

    // Remove code from codes array
    setCodes((prev) => prev.filter((c) => c.id !== id));

    // No code should be active after deletion -> set activeCodeId to null
    setActiveCodeId(null);

    return affectedPassageId;
  };

  const editAllInstancesOfCode = (oldValue: string, newValue: string) => {
    setCodes((prev) => {
      const idsToEdit = prev.filter((c) => c.code === oldValue).map((c) => c.id);
      return prev.map((code) =>
        idsToEdit.includes(code.id) ? { ...code, code: newValue } : code
      );
    });
  };

  const separateMultipleCodes = (codeString: string) => {
    const codeList = codeString
      .split(";")
      .map((code) => code.trim())
      .filter(Boolean);
    return codeList;
  };

  return { updateCode, deleteCode, editAllInstancesOfCode };
};

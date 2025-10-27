import { useContext } from "react";
import { Code, WorkflowContext } from "../../../context/WorkflowContext";

interface UseCodeManagerProps {
  activeCodeId: number | null;
  setActiveCodeId: React.Dispatch<React.SetStateAction<number | null>>;
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
  activeCodeId,
  setActiveCodeId,
}: UseCodeManagerProps) => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useCodeManager must be used within a WorkflowProvider");
  }

  const {
    codes,
    setCodes,
    passages,
    setPassages,
    nextCodeId,
    setNextCodeId,
  } = context;


  /**
   * Updates the value of a specific code. (Note: passages state is updated in the WorkflowContext useEffect)
   * @param id - the id of the code to be updated
   * @param newValue - the new value of the code
   */
  const updateCode = (id: number, newValue: string) => {
    const codeObject = codes.find((c) => c.id === id);
    if (!codeObject) return;

    const codeList = separateMultipleCodes(newValue.trim());
    let newCodeId = nextCodeId;

    // Update existing code with first value, only create new codes for additional values
    let newCodes = codes.map(c => 
      c.id === id ? { ...c, code: codeList[0] } : c
    );
    
    // Add new codes for any additional values after semicolons
    if (codeList.length > 1) {
      const additionalCodes = codeList.slice(1).map(code => ({
        id: newCodeId++,
        passageId: codeObject.passageId,
        code: code
      }));
      newCodes = [...newCodes, ...additionalCodes];
    }

    setCodes(newCodes);
    setNextCodeId(newCodeId);
    return;
  };


  /**
   * Deletes a code.
   * @param id - the id of the code to be deleted
   */
  const deleteCode = (id: number) => {
    // 1. Find affected passage from the passages state
    const affectedPassage = passages.find((p) => p.codeIds.includes(id));
    if (!affectedPassage) return;

    // 2. Remove the code from the codes array. This automatically updates the codebook and passages via WorkflowContext useEffect.
    const updatedCodes = codes.filter((c) => c.id !== id);
    setCodes(() => updatedCodes);

    // 3. Based on the passageId values of updatedCodes, check whether the affected passage still has codeIds left.
    const remainingForPassage = updatedCodes.filter((c) => c.passageId === affectedPassage.id);
    if (remainingForPassage.length > 0) {
      // Still codes for this passage
      setActiveCodeId(null);
      return;
    }

    // 4. Otherwise: passage has no codes left and it may have to be merged with neighboring passages.
    setPassages((prev) => {
      const updatedPassage = { ...affectedPassage, codeIds: [] };
      // Find the neighbors of the passage based on order, to check whether they are empty and can be merged
      const prevPassage = passages.find(
        (p) => p.order === updatedPassage.order - 1
      );
      const nextPassage = passages.find(
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
      const newMergedPassage = {
        id: updatedPassage.id, // reuse the current one’s id
        order: mergePrev ? prevPassage.order : updatedPassage.order,
        text: mergedText,
        codeIds: [],
      };

      // Insert the new merged passage and remove the old ones
      const filtered = prev.filter((p) => !passagesToRemove.includes(p.id));
      const inserted = [...filtered, newMergedPassage];
      const sorted = inserted.sort((a, b) => a.order - b.order);
      return sorted.map((p, i) => ({ ...p, order: i }));
    });

    // 5. No code should be active after deletion -> set activeCodeId to null
    setActiveCodeId(null);
  };


  /**
   * Handles a keyboard event that occurs during code editing.
   * @param e - the keyboard event that triggered the function call
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (activeCodeId === null) return;
    if (!e.currentTarget) return;

    // ENTER, TAB, ESCAPE: finalize editing of the current code
    if (["Enter", "Tab", "Escape"].includes(e.key)) {
      e.preventDefault(); // Prevents default behaviour of the tab button

      // Get the code object being edited
      const codeObject: Code | undefined = codes.find(
        (c) => c.id === activeCodeId
      );
      if (!codeObject) return;

      // Update code handles separation of multiple codes if needed
      updateCode(activeCodeId, e.currentTarget.value);

      // Deactivate the active code
      setActiveCodeId(null);
      e.currentTarget.blur();
      return;
    }

    // DELETE: delete the current code
    if (e.key === "Delete") {
      e.preventDefault();
      deleteCode(activeCodeId);
    }
  };


  const editAllInstancesOfCode = (oldValue: string, newValue: string) => {
    const idsToEdit = codes
      .filter((c) => c.code === oldValue)
      .map((c) => c.id);
    const newArray = codes.map(code =>
      idsToEdit.includes(code.id) ? {...code, code: newValue} : code
    );
    setCodes(newArray);
  }


  const separateMultipleCodes = (codeString: string) => {
    const codeList = codeString.split(";").map((code) => code.trim());
    return codeList;
  }

  return { updateCode, deleteCode, handleKeyDown, editAllInstancesOfCode };
};

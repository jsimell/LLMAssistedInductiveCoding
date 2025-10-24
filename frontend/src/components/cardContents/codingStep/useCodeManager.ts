import { useContext, useCallback } from "react";
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
    setCodebook,
  } = context;

  /**
   * Updates the value of a specific code.
   * @param id - the id of the code to be updated
   * @param newValue - the new value of the code
   */
  const updateCode = useCallback(
    (id: number, newValue: string) => {
      setCodes((prev) =>
        prev.map((c) => (c.id === id ? { ...c, code: newValue } : c))
      );
    },
    [setCodes]
  );

  /**
   * Deletes a code.
   * @param id - the id of the code to be deleted
   */
  const deleteCode = useCallback(
    (id: number) => {
      // 1. Remove the code from the codes array
      const updatedCodes = codes.filter((c) => c.id !== id);
      setCodes(() => updatedCodes);

      // 2. Update the codebook
      // After deleting, recalculate the codebook from the remaining codes
      setCodebook(new Set(updatedCodes.map((c) => c.code)));

      // 3. Find the passage that contains this codeId
      const passage = passages.find((p) => p.codeIds.includes(id));
      if (!passage) return;

      // 4. Remove the codeId from the passage’s codeIds
      const updatedPassage = {
        ...passage,
        codeIds: passage.codeIds.filter((cid) => cid !== id),
      };

      // 5. Check whether the updated passage still has codeIds left
      // If it still has other codes, simply replace it in the passages array and return
      if (updatedPassage.codeIds.length > 0) {
        setPassages((prev) =>
          prev.map((p) => (p.id === updatedPassage.id ? updatedPassage : p))
        );
        return;
      }

      // 6. If the passage has no codes left:
      //    Check its neighbors based on order
      const prevPassage = passages.find(
        (p) => p.order === updatedPassage.order - 1
      );
      const nextPassage = passages.find(
        (p) => p.order === updatedPassage.order + 1
      );
      const mergePrev = prevPassage && prevPassage.codeIds.length === 0;
      const mergeNext = nextPassage && nextPassage.codeIds.length === 0;

      // 7. Determine merged text and which passages to remove from the passages state
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

      // 8. Create a new merged passage (empty codeIds)
      const newMergedPassage = {
        id: updatedPassage.id, // reuse the current one’s id
        order: mergePrev ? prevPassage.order : updatedPassage.order,
        text: mergedText,
        codeIds: [],
      };

      // 9. Update the passages state:
      setPassages((prev) => {
        const filtered = prev.filter((p) => !passagesToRemove.includes(p.id));
        const inserted = [...filtered, newMergedPassage];
        const sorted = inserted.sort((a, b) => a.order - b.order);
        return sorted.map((p, i) => ({ ...p, order: i }));
      });

      // 10. No code should be active after deletion -> set activeCodeId to null
      setActiveCodeId(null);
    },
    [codes, passages, setCodes, setPassages, setCodebook]
  );

  /**
   * Handles a keyboard event that occurs during .
   * @param e - the keyboard event that triggered the function call
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (activeCodeId === null) return;
      if (!e.currentTarget) return;
      const newValue = e.currentTarget.value;
      if (["Enter", "Tab", "Escape"].includes(e.key)) {
        e.preventDefault(); // Prevents default behaviour of the tab button
        const codeObject: Code | undefined = codes.find(
          (c) => c.id === activeCodeId
        );
        if (!codeObject) return;
        const { id, code } = codeObject;
        if (id === undefined || code === undefined) return;
        if (codeObject.code.length === 0) {
          deleteCode(activeCodeId);
          return;
        }
        setCodebook((prev) => new Set([...prev, newValue]));
        setActiveCodeId(null);
        e.currentTarget.blur();
        return;
      }
      if (e.key === "Delete") {
        e.preventDefault();
        deleteCode(activeCodeId);
      }
    },
    [codes, deleteCode, setCodebook]
  );

  return { updateCode, deleteCode, handleKeyDown };
};

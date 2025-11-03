import { useContext } from "react";
import { AIsuggestion, WorkflowContext } from "../../../../context/WorkflowContext";
import { useCodeSuggestions } from "./useCodeSuggestions";
import { useFullSuggestions } from "./useFullSuggestions";

export const useAIsuggestionManager = () => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useAIsuggestionManager must be used within a WorkflowProvider");
  }
  const { codes, passages, setPassages, nextSuggestionId, setNextSuggestionId } = context;

  const { getCodeSuggestions } = useCodeSuggestions();
  const { getFullSuggestions } = useFullSuggestions();


  /**
   * Helper to check if two codeId arrays are equal
   */
  const areCodeIdsEqual = (ids1: number[], ids2: number[]): boolean => {
    if (ids1.length !== ids2.length) return false;
    return ids1.every((id, index) => id === ids2[index]);
  };


  /**
   * Updates AI suggestions for a specific passage in the passages state, and returns the new AI suggestions for the passage.
   * @param passageId 
   * @returns the new AI suggestions for the passage, or null if the passage no longer existed when API call finished
   */
  const updateSuggestionsForPassage = async (passageId: number) => {
    // Find the passage
    const passage = passages.find(p => p.id === passageId);
    if (!passage || !passage.text) return null;

    const codeIdsBeforeAPI = [...passage.codeIds];

    let newSuggestionsArray: AIsuggestion[] = [];

    // CASE 1: Uncoded passage -> get full suggestions
    if (passage.codeIds.length === 0) {
      newSuggestionsArray = await getFullSuggestions(passage.id);
      setPassages(prev => {
        const currentPassage = prev.find(p => p.id === passageId);
        // Guard: Only update if passage still exists with same (empty) codes
        if (!currentPassage || !areCodeIdsEqual(currentPassage.codeIds, codeIdsBeforeAPI)) {
          return prev; // Passage deleted or codes changed, skip update
        }
        return prev.map(p =>
          p.id === passageId ? { ...p, aiSuggestions: newSuggestionsArray } : p
        );
      });

    // CASE 2: Highlighted passage - get code suggestions for the passage
    } else {
      const existingCodes = passage.codeIds
        .map(codeId => {
          const codeObj = codes.find(c => c.id === codeId);
          return codeObj ? codeObj.code : "";
        })
        .filter(Boolean);

      const codeSuggestions = await getCodeSuggestions(passage.text, existingCodes);

      // If API returned nothing, add an empty suggestions array
      if (!codeSuggestions || codeSuggestions.trim().length === 0) {
        setPassages(prev => {
          const currentPassage = prev.find(p => p.id === passageId);
          // Guard: Only update if passage still exists with same codes
          if (!currentPassage || !areCodeIdsEqual(currentPassage.codeIds, codeIdsBeforeAPI)) {
            return prev;
          }
          return prev.map(p =>
            p.id === passageId ? { ...p, aiSuggestions: [] } : p
          );
        });
        return [];
      }

      // Construct the AIsuggestion
      newSuggestionsArray = [{
        id: nextSuggestionId,
        parentPassageId: passageId,
        subPassageText: passage.text,
        startIndex: 0,
        endIndex: passage.text.length,
        suggestedCodes: codeSuggestions,
      }];
      
      setPassages(prev => {
        const currentPassage = prev.find(p => p.id === passageId);
        // Guard: Only update if passage still exists with same codes
        if (!currentPassage || !areCodeIdsEqual(currentPassage.codeIds, codeIdsBeforeAPI)) {
          return prev; // Passage deleted or codes changed, skip update
        }

        // Increment the suggestion ID for future suggestions
        setNextSuggestionId(prevId => prevId + 1);

        return prev.map(p => 
          p.id === passageId ? { ...p, aiSuggestions: newSuggestionsArray } : p
        );
      });
    }

    return newSuggestionsArray;
  };

  return {
    updateSuggestionsForPassage,
  };
};
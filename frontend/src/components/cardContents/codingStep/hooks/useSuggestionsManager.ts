import { useCallback, useRef, useContext, useState } from "react";
import {
  HighlightSuggestion,
  PassageId,
  WorkflowContext,
} from "../../../../context/WorkflowContext";
import { useCodeSuggestions } from "./apiCommunication/useCodeSuggestions";
import { useHighlightSuggestions } from "./apiCommunication/useHighlightSuggestions";

/**
 * Central orchestrator for AI suggestions (highlight + code).
 */
export const useSuggestionsManager = () => {
  const context = useContext(WorkflowContext);
  if (!context)
    throw new Error(
      "useSuggestionsManager must be used within a WorkflowProvider"
    );

  const { passages, setPassages, aiSuggestionsEnabled } = context;

  const { getCodeSuggestions, getAutocompleteSuggestions } = useCodeSuggestions();
  const { getNextHighlightSuggestion } = useHighlightSuggestions();

  // STATE
  // For exporting highlight suggestion loading state, updated in an effect based on
  const [isFetchingHighlightSuggestion, setIsFetchingHighlightSuggestion] = useState<boolean>(false);

  // REFS
  // Track the latest call timestamp per passage to ignore outdated results
  const latestCallTimestamps = useRef<Map<PassageId, number>>(new Map());
  // Track the number of in-flight highlight suggestion fetches
  const ongoingHighlightFetchesCount = useRef<number>(0);

  // MAIN FUNCTIONS

  /**
   * Requests the next highlight suggestion for the given passage.
   * @param id The ID of the passage for which to request a highlight suggestion.
   * @param searchIndex The character index in the passage text from which to start searching for the next highlight suggestion.
   */
  const refreshHighlightSuggestion = async (
    id: PassageId,
    searchStartIndex: number,
    callTimestamp: number
  ): Promise<HighlightSuggestion | null> => {
    if (!aiSuggestionsEnabled) return null;
    const passage = passages.find((p) => p.id === id);
    if (!passage || passage.isHighlighted) return null;

    ongoingHighlightFetchesCount.current += 1;
    setIsFetchingHighlightSuggestion(true);

    let suggestion: HighlightSuggestion | null = null;
    try {
      // Prioritize provided startIndex, otherwise use stored one, or default to 0
      suggestion =
        searchStartIndex >= passage.text.length
          ? null
          : await getNextHighlightSuggestion(passage, searchStartIndex);

      // Only update if this is still the latest call
      if (latestCallTimestamps.current.get(id) === callTimestamp) {
        setPassages((prev) =>
          prev.map((p) =>
            p.id === id && !p.isHighlighted
              ? { ...p, nextHighlightSuggestion: suggestion }
              : p
          )
        );
      }
    } catch (error) {
      console.error("Error fetching highlight suggestion:", error);
    } finally {
      ongoingHighlightFetchesCount.current -= 1;
      if (ongoingHighlightFetchesCount.current === 0) {
        setIsFetchingHighlightSuggestion(false);
      }
      return suggestion;
    }
  };

  /** Refreshes code suggestions for the given passage.
   * @param id The ID of the passage for which to refresh code suggestions.
   */
  const refreshCodeSuggestions = async (
    id: PassageId,
    callTimestamp: number
  ) => {
    if (!aiSuggestionsEnabled) return;
    const passage = passages.find((p) => p.id === id);
    if (!passage || !passage.isHighlighted) return;

    try {
      const suggestions = await getCodeSuggestions(passage);

      // Only update if this is still the latest call
      if (latestCallTimestamps.current.get(id) === callTimestamp) {
        setPassages((prev) =>
          prev.map((p) =>
            p.id === id && p.isHighlighted
              ? {
                  ...p,
                  codeSuggestions: suggestions,
                  nextHighlightSuggestion: null,
                }
              : p
          )
        );
      }
    } catch (error) {
      console.error("Error fetching code suggestions:", error);
    }
  };

  /** Refreshes autocomplete suggestions for the given passage.
   * @param id The ID of the passage for which to refresh autocomplete suggestions.
   */
  const refreshAutocompleteSuggestions = async (
    id: PassageId,
    callTimestamp: number
  ) => {
    if (!aiSuggestionsEnabled) return;
    const passage = passages.find((p) => p.id === id);
    if (!passage || !passage.isHighlighted) return;

    try {
      const suggestions = await getAutocompleteSuggestions(passage);

      // Only update if this is still the latest call
      if (latestCallTimestamps.current.get(id) === callTimestamp) {
        setPassages((prev) =>
          prev.map((p) =>
            p.id === id && p.isHighlighted
              ? {
                  ...p,
                  autocompleteSuggestions: suggestions,
                  nextHighlightSuggestion: null,
                }
              : p
          )
        );
      }
    } catch (error) {
      console.error("Error fetching autocomplete suggestions:", error);
    }
  };

  /**
   * Ensures that the given passage has up-to-date suggestions.
   * If highlighted, refreshes code suggestions; if not, requests highlight suggestion.
   */
  const updateSuggestionsForPassage = useCallback(async (id: PassageId) => {
    if (!aiSuggestionsEnabled) return;
    const callTimestamp = Date.now(); // Unique timestamp for this call
    latestCallTimestamps.current.set(id, callTimestamp); // Mark as latest
    const passage = passages.find((p) => p.id === id);
    if (!passage) return;

    if (passage.isHighlighted) {
      await refreshCodeSuggestions(id, callTimestamp);
      await refreshAutocompleteSuggestions(id, callTimestamp);
    } else {
      await refreshHighlightSuggestion(id, 0, callTimestamp);
    }
  }, [passages]);

  /**
   * Fetches a new highlight suggestion for the given passage, effectively declining the previous one.
   * @param id The ID of the passage for which to decline the highlight suggestion.
   */
  const declineHighlightSuggestion = useCallback(
    async (id: PassageId) => {
      const passage = passages.find((p) => p.id === id);
      if (!passage || passage.isHighlighted) return;

      const suggestion = passage.nextHighlightSuggestion;
      if (!suggestion) return; // No suggestion to decline

      const suggestionStartIdx = passage.text.indexOf(suggestion.passage);
      if (suggestionStartIdx === -1) return;

      // Calculate new search start index to be after the declined suggestion
      const searchStartIdx = suggestionStartIdx + suggestion.passage.length;

      const callTimestamp = Date.now(); // Unique timestamp for this call
      latestCallTimestamps.current.set(id, callTimestamp); // Mark as latest

      await refreshHighlightSuggestion(id, searchStartIdx, callTimestamp);
    },
    [passages]
  );

  /** Finds the first suitable non-highlighted passage starting from the given passage,
   * and requests a new highlight suggestion for it.
   * @param id The ID of the passage after which to update the highlight suggestion.
   * @return The ID of the passage for which the highlight suggestion was updated, or null if none found, or AI suggestions are disabled.
   */
  const inclusivelyFetchHighlightSuggestionAfter = useCallback(async (id: PassageId) => {
    if (!aiSuggestionsEnabled) return null;
    const passage = passages.find((p) => p.id === id);
    if (!passage) {
      console.warn("Highlight suggestion fetch exited early because passage was not found for id:", id);
      return null;
    }
    // Find the non-highlighted passages starting from the given passage
    const candidates = passages.filter(
      (p) => p.order >= passage.order && !p.isHighlighted && p.text.trim().length > 4   // Filter out also very short passages
    );

    // Fetch new highlight suggestions for these, until the LLM provides a valid one
    for (const np of candidates) {
      const callTimestamp = Date.now(); // Unique timestamp for this call
      latestCallTimestamps.current.set(np.id, callTimestamp); // Mark as latest

      const suggestion = await refreshHighlightSuggestion(np.id, 0, callTimestamp);
      
      if (
        suggestion &&
        suggestion.passage.trim().length > 0 &&
        suggestion.code.trim().length > 0
      ) {
        // Valid suggestion obtained, stop here
        return np.id as PassageId;
      }
    }
    return null;
  }, [passages]);

  return {
    declineHighlightSuggestion,
    updateSuggestionsForPassage,
    inclusivelyFetchHighlightSuggestionAfter,
    isFetchingHighlightSuggestion,
  };
};

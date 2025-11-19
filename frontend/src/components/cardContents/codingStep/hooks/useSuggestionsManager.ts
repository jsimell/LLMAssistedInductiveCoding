import { useCallback, useRef, useContext, useEffect, use, useState } from "react";
import { HighlightSuggestion, Passage, PassageId, WorkflowContext } from "../../../../context/WorkflowContext";
import { useCodeSuggestions } from "./apiCommunication/useCodeSuggestions";
import { useHighlightSuggestions } from "./apiCommunication/useHighlightSuggestions";


/**
 * Central orchestrator for AI suggestions (highlight + code).
 */
export const useSuggestionsManager = () => {
  const context = useContext(WorkflowContext);
  if (!context) throw new Error("useSuggestionsManager must be used within a WorkflowProvider");

  const { passages, setPassages, aiSuggestionsEnabled, showHighlightSuggestionFor, activeCodeId, codes, setShowHighlightSuggestionFor } = context;

  const { getCodeSuggestions, getAutocompleteSuggestions } = useCodeSuggestions();
  const { getNextHighlightSuggestion } = useHighlightSuggestions();

  // STATE
  const [suggestionQueue, setSuggestionQueue] = useState<Set<PassageId>>(new Set());
  // For exporting highlight suggestion loading state
  const [fetchingHighlightSuggestion, setFetchingHighlightSuggestion] = useState<boolean>(false);

  // REFS
  // Per-passage search start index for highlight suggestions
  //const searchStartIndicesMap = useRef<Map<PassageId, number>>(new Map());
  // Per-passage in-flight guard
  const inFlight = useRef<Set<PassageId>>(new Set());
  // Previous passages ref for diffing
  const prevRef = useRef<Passage[]>(passages);
  // Global in-flight guard
  const isFetchingSuggestions = useRef(false);
  // If passage changes during an ongoing fetch, queue it in here to be processed after the fetch 
  const pendingForSuggestionFetch = useRef<Set<PassageId>>(new Set());


  // EFFECTS
  /**
   * Effect to add the parent passage of the active code to the suggestion queue when a code becomes active.
   */
  useEffect(() => {
    if (!activeCodeId) return;

    const codeObject = codes.find(c => c.id === activeCodeId);
    const passageId = codeObject?.passageId;
    if (!passageId) return;
    
    // If the passage is already in the queue, no need to add again
    if (suggestionQueue.has(passageId)) return;

    // If a fetch is ongoing, accumulate changes to pendingForSuggestionFetch
    if (isFetchingSuggestions.current) {
      // Accumulate pending changes instead of skipping entirely
      pendingForSuggestionFetch.current.add(passageId);
      prevRef.current = passages; // update for next run
      return;
    }

    setSuggestionQueue(prev => {
      const newQueue = new Set(prev);
      newQueue.add(passageId);
      return newQueue;
    });
  }, [activeCodeId]);

  /**
   * Effect to add the passage in showHighlightSuggestionFor to the suggestion queue when it changes.
   */
  useEffect(() => {
    if (!showHighlightSuggestionFor) return;

    // If the passage is already in the queue, no need to add again
    if (suggestionQueue.has(showHighlightSuggestionFor)) return;

    // If a fetch is ongoing, accumulate changes to pendingForSuggestionFetch
    if (isFetchingSuggestions.current) {
      // Accumulate pending changes instead of skipping entirely
      pendingForSuggestionFetch.current.add(showHighlightSuggestionFor);
      prevRef.current = passages; // update for next run
      return;
    }

    setSuggestionQueue(prev => {
      const newQueue = new Set(prev);
      newQueue.add(showHighlightSuggestionFor);
      return newQueue;
    });
  }, [showHighlightSuggestionFor]);

  /**
   * Effect to trigger suggestion fetching for queued passages when queue changes.
   */
  useEffect(() => {
    if (suggestionQueue.size === 0) return; // Nothing to process 

    isFetchingSuggestions.current = true;

    const fetchSuggestionsForQueue = async () => {
      for (const id of suggestionQueue) {
        const passage = passages.find(p => p.id === id);
        if (!passage) continue;
        await updateSuggestionsForPassage(passage);
      }
      setSuggestionQueue(new Set());

      // After fetch, process any pending changes accumulated during the fetch
      if (pendingForSuggestionFetch.current.size > 0) {
        setSuggestionQueue(prev => new Set([...prev, ...pendingForSuggestionFetch.current]));
        pendingForSuggestionFetch.current.clear();
      }

      isFetchingSuggestions.current = false;
    };

    fetchSuggestionsForQueue();
  }, [suggestionQueue]);


  // HELPERS
  /** 
   * Sets or unsets the in-flight status for a passage 
   * @param id The ID of the passage
   * @param v true to set in-flight, false to unset
   */
  const setInFlight = (id: PassageId, v: boolean) => {
    if (v) inFlight.current.add(id);
    else inFlight.current.delete(id);
  };


  // MAIN FUNCTIONS

  /**
   * Requests the next highlight suggestion for the given passage.
   * @param id The ID of the passage for which to request a highlight suggestion.
   * @param startIndex The character index in the passage text from which to start searching for the next highlight suggestion.
   */
  const refreshHighlightSuggestion = async (id: PassageId, searchStartIndex: number) => {
    if (!aiSuggestionsEnabled) return;
    const passage = passages.find(p => p.id === id);
    if (!passage || passage.isHighlighted) return;

    if (inFlight.current.has(id)) return;
    setInFlight(id, true);
    setFetchingHighlightSuggestion(true);
    try {
      // Prioritize provided startIndex, otherwise use stored one, or default to 0
      const suggestion = (searchStartIndex >= passage.text.length) ? null : await getNextHighlightSuggestion(passage, searchStartIndex);

      setPassages(prev =>
        prev.map(p =>
          p.id === id && !p.isHighlighted
            ? { ...p, nextHighlightSuggestion: suggestion ?? null }
            : p
        )
      );
    } catch (error) {
      console.error("Error fetching highlight suggestion:", error);
    } finally {
      setInFlight(id, false);
      setFetchingHighlightSuggestion(false);
    }
  };


  /** Refreshes code suggestions for the given passage.
   * @param id The ID of the passage for which to refresh code suggestions.
   */
  const refreshCodeSuggestions = async (id: PassageId) => {
    if (!aiSuggestionsEnabled) return;
    const passage = passages.find(p => p.id === id);
    if (!passage || !passage.isHighlighted) return;

    if (inFlight.current.has(id)) return;
    setInFlight(id, true);
    try {
      const suggestions = await getCodeSuggestions(passage);

      setPassages(prev =>
        prev.map(p =>
          p.id === id && p.isHighlighted
            ? { ...p, codeSuggestions: suggestions, nextHighlightSuggestion: null }
            : p
        )
      );
    } catch (error) {
      console.error("Error fetching code suggestions:", error);
    } finally {
      setInFlight(id, false);
    }
  };


  /** Refreshes autocomplete suggestions for the given passage.
   * @param id The ID of the passage for which to refresh autocomplete suggestions.
   */
  const refreshAutocompleteSuggestions = async (id: PassageId) => {
    if (!aiSuggestionsEnabled) return;
    const passage = passages.find(p => p.id === id);
    if (!passage || !passage.isHighlighted) return;

    if (inFlight.current.has(id)) return;
    setInFlight(id, true);
    try {
      const suggestions = await getAutocompleteSuggestions(passage);

      setPassages(prev =>
        prev.map(p =>
          p.id === id && p.isHighlighted
            ? { ...p, autocompleteSuggestions: suggestions, nextHighlightSuggestion: null }
            : p
        )
      );
    } catch (error) {
      console.error("Error fetching autocomplete suggestions:", error);
    } finally {
      setInFlight(id, false);
    }
  };


  /**
   * Ensures that the given passage has up-to-date suggestions.
   * If highlighted, refreshes code suggestions; if not, requests highlight suggestion.
   */
  const updateSuggestionsForPassage = async (passage: Passage) => {
    if (passage.isHighlighted) {
      await refreshCodeSuggestions(passage.id);
      await refreshAutocompleteSuggestions(passage.id);
    } else {
      // Only request new highlight suggestion if there isn't one already
      if (!passage.nextHighlightSuggestion) {
        await refreshHighlightSuggestion(passage.id, 0);
      }
    }
  };


  /**
   * Fetches a new highlight suggestion for the given passage, effectively declining the previous one.
   * @param id The ID of the passage for which to decline the highlight suggestion.
   */
  const declineHighlightSuggestion = useCallback(async (id: PassageId) => {
    const passage = passages.find(p => p.id === id);
    if (!passage || passage.isHighlighted) return;

    const suggestion = passage.nextHighlightSuggestion;
    if (!suggestion) return; // No suggestion to decline

    const suggestionStartIdx = passage.text.indexOf(suggestion.passage);
    if (suggestionStartIdx === -1) return;

    // Calculate new search start index to be after the declined suggestion
    const searchStartIdx = suggestionStartIdx + (suggestion.passage.length);

    await refreshHighlightSuggestion(id, searchStartIdx);
    setShowHighlightSuggestionFor(id);
  }, [passages]);

  return {
    declineHighlightSuggestion,
    fetchingHighlightSuggestion,
  };
};
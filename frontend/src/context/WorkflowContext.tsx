import React, { createContext, useState, useEffect } from "react";

// Base properties shared by all passages
interface BasePassage {
  id: number;
  order: number;
  text: string;
}

// Unhighlighted passage (no codes)
interface UnhighlightedPassage extends BasePassage {
  isHighlighted: false;
  codeIds: []; // No codes for unhighlighted passages
  codeSuggestions: []; // No code suggestions for unhighlighted passages
  nextHighlightSuggestion: HighlightSuggestion | null;
}

// Highlighted passage (has codes and AI suggestions)
interface HighlightedPassage extends BasePassage {
  isHighlighted: true;
  codeIds: number[];
  codeSuggestions: string[];
  nextHighlightSuggestion: null;
}

// Discriminated union
export type Passage = UnhighlightedPassage | HighlightedPassage;

export interface Code {
  id: number; // A unique id
  passageId: number;
  code: string;
}

export interface HighlightSuggestion {
  passage: string;
  code: string;
}

export interface FileInfo {
  name: string;
}

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

export const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export interface WorkflowContextType {
  apiKey: string;
  setApiKey: Setter<string>;

  researchQuestions: string;
  setResearchQuestions: Setter<string>;

  contextInfo: string;
  setContextInfo: Setter<string>;

  fileInfo: FileInfo | null;
  setFileInfo: Setter<FileInfo | null>;

  rawData: string;
  setRawData: Setter<string>;

  aiSuggestionsEnabled: boolean;
  setAiSuggestionsEnabled: Setter<boolean>;

  currentStep: number;
  setCurrentStep: Setter<number>;

  proceedAvailable: boolean;
  setProceedAvailable: Setter<boolean>;

  passages: Passage[];
  setPassages: Setter<Passage[]>;

  codes: Code[];
  setCodes: Setter<Code[]>;

  nextCodeId: number;
  setNextCodeId: Setter<number>;

  nextPassageId: number;
  setNextPassageId: Setter<number>;

  nextSuggestionId: number;
  setNextSuggestionId: Setter<number>;

  codebook: Set<string>;
  setCodebook: Setter<Set<string>>;

  contextWindowSize: number | null;
  setContextWindowSize: Setter<number | null>;
}

export function WorkflowProvider({ children }: { children: React.ReactNode }) {

  // Global states
  const [apiKey, setApiKey] = useState<string>("");
  const [researchQuestions, setResearchQuestions] = useState<string>("");
  const [contextInfo, setContextInfo] = useState<string>("");
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [rawData, setRawData] = useState<string>("");   // The text content of the uploaded file
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState<boolean>(true); // Global toggle
  const [currentStep, setCurrentStep] = useState<number>(1);    // The current step of the workflow
  const [proceedAvailable, setProceedAvailable] = useState<boolean>(false);  // Defines whether or not user can currently proceed to the next step
  const [nextCodeId, setNextCodeId] = useState<number>(0);  // Next unique id for a new code
  const [nextPassageId, setNextPassageId] = useState<number>(0);   // Next unique id for a new passage
  const [nextSuggestionId, setNextSuggestionId] = useState<number>(0); // Next unique id for a new AI suggestion
  const [passages, setPassages] = useState<Passage[]>([]);  // The passages of the data coding phase
  const [codes, setCodes] = useState<Code[]>([]);  // The codes of the data coding phase (contains all code instances, even duplicates)
  const [codebook, setCodebook] = useState<Set<string>>(new Set()) // Contains all unique codes
  const [contextWindowSize, setContextWindowSize] = useState<number | null>(500); // Number of characters in the context window for AI suggestions

  // Set the raw data as the first passage once it is uploaded
  useEffect(() => {
    if (rawData) {
      setNextPassageId(prevId => {
        setPassages([{ id: prevId, order: 0, text: rawData, isHighlighted: false, codeIds: [], codeSuggestions: [], nextHighlightSuggestion: null }]);
        return prevId + 1;
      })
    };
  }, [rawData]);

  // Keep codebook in sync with the `codes` state
  useEffect(() => {
    setCodebook(new Set(codes.map((c) => c.code)));
  }, [codes]);

  // Combine all states + updaters into one object
  const value = {
    apiKey, setApiKey,
    researchQuestions, setResearchQuestions,
    contextInfo, setContextInfo,
    rawData, setRawData,
    aiSuggestionsEnabled, setAiSuggestionsEnabled,
    currentStep, setCurrentStep,
    proceedAvailable, setProceedAvailable,
    fileInfo, setFileInfo,
    passages, setPassages,
    codes, setCodes,
    nextCodeId, setNextCodeId,
    nextPassageId, setNextPassageId,
    codebook, setCodebook,
    nextSuggestionId, setNextSuggestionId,
    contextWindowSize, setContextWindowSize,
  };

  // Make the states available to all children components
  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}
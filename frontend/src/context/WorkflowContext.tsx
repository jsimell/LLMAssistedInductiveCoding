import React, { createContext, useState, useEffect, use } from "react";

export interface Passage {
  id: number; // A unique id
  order: number;
  text: string;
  codeIds: number[];
}

export interface Code {
  id: number; // A unique id
  passageId: string;
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

  codebook: Set<string>;
  setCodebook: Setter<Set<string>>;
}

export function WorkflowProvider({ children }: { children: React.ReactNode }) {

  // Global states
  const [apiKey, setApiKey] = useState<string>("");
  const [researchQuestions, setResearchQuestions] = useState<string>("");
  const [contextInfo, setContextInfo] = useState<string>("");
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [rawData, setRawData] = useState<string>("");   // The text content of the uploaded file
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState<boolean>(false); // Global toggle
  const [currentStep, setCurrentStep] = useState<number>(1);    // The current step of the workflow
  const [proceedAvailable, setProceedAvailable] = useState<boolean>(false);  // Defines whether or not user can currently proceed to the next step
  const [nextCodeId, setNextCodeId] = useState<number>(0);  // Next unique id for a new code
  const [nextPassageId, setNextPassageId] = useState<number>(0);   // Next unique id for a new passage
  const [passages, setPassages] = useState<Passage[]>([]);  // The passages of the data coding phase
  const [codes, setCodes] = useState<Code[]>([]);  // The codes of the data coding phase (contains all code instances, even duplicates)
  const [codebook, setCodebook] = useState<Set<string>>(new Set()) // Contains all unique codes

  // Set the raw data as the first passage once it is uploaded
  useEffect(() => {
  if (rawData) {
    setNextPassageId(prevId => {
      setPassages([{ id: prevId, order: 0, text: rawData, codeIds: [] }]);
      return prevId + 1;
    })
  };
}, [rawData]);

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
    codebook, setCodebook
  };

  // Make the states available to all children components
  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}
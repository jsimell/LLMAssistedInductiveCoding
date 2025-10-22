import React, { createContext, useState, useEffect } from "react";

interface Passage {
  uid: number;
  order: number;
  text: string;
  codeIds: number[];
}

interface Code {
  id: number;
  passageId: string;
  code: string;
}

interface FileInfo {
  name: string;
}

export const WorkflowContext = createContext<any>(null);

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

  //// TODO: CHANGE THE STRUCTURE OF THE BELOW STATES ////
  // The passages in the data coding phase. 
  // Values should have form: { id: <string(uuidv4())>, order: <int>, text: <string>, codeIds: Array<int> }
  const [passages, setPassages] = useState<Passage[]>([]);
  // The codes are stored in the separate "codes" state as: {id: <int>, passageId: <string(uuidv4())>, code: <string>}
  // NOTE: This is not like a codebook, which contains all codes only once.
  // Instead, all inserted codes (even duplicates) are stored in this state with a unique id.
  const [codes, setCodes] = useState<Code[]>([]);

  // Set the raw data as the first passage once it is uploaded
  useEffect(() => {
  if (rawData) {
    setNextPassageId(prevId => {
      setPassages([{ uid: prevId, order: 0, text: rawData, codeIds: [] }]);
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
  };

  // Make the states available to all children components
  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}
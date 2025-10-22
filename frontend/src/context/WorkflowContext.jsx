import React, { createContext, useState, useEffect } from "react";

export const WorkflowContext = createContext();

export function WorkflowProvider({ children }) {

  // Global states
  const [apiKey, setApiKey] = useState(null);
  const [researchQuestions, setResearchQuestions] = useState([]);
  const [contextInfo, setContextInfo] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);    // Stores the name and size of the uploaded file
  const [rawData, setRawData] = useState("");           // Entire imported text
  const [codedData, setCodedData] = useState([]);       // Data with codes applied
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState(true); // Global toggle
  const [currentStep, setCurrentStep] = useState(1);    // The current step of the workflow
  const [proceedAvailable, setProceedAvailable] = useState(false);  // Defines whether or not user can currently proceed to the next step
  const [nextCodeId, setNextCodeId] = useState(0);  // Next unique id for a new code
  const [nextPassageId, setNextPassageId] = useState(0);   // Next unique id for a new passage

  //// TODO: CHANGE THE STRUCTURE OF THE BELOW STATES ////
  // The passages in the data coding phase. 
  // Values should have form: { id: <string(uuidv4())>, order: <int>, text: <string>, codeIds: Array<int> }
  const [passages, setPassages] = useState([]);
  // The codes are stored in the separate "codes" state as: {id: <int>, passageId: <string(uuidv4())>, code: <string>}
  // NOTE: This is not like a codebook, which contains all codes only once.
  // Instead, all inserted codes (even duplicates) are stored in this state with a unique id.
  const [codes, setCodes] = useState([]);

  // Set the raw data as the first passage once it is uploaded
  useEffect(() => {
  if (rawData) {
    setPassages([{ position: 0, text: rawData, codeIds: [] }]);
  }
}, [rawData]);

  // Combine all states + updaters into one object
  const value = {
    apiKey, setApiKey,
    researchQuestions, setResearchQuestions,
    contextInfo, setContextInfo,
    rawData, setRawData,
    codedData, setCodedData,
    aiSuggestionsEnabled, setAiSuggestionsEnabled,
    currentStep, setCurrentStep,
    proceedAvailable, setProceedAvailable,
    fileInfo, setFileInfo,
    passages, setPassages,
    codes, setCodes,
  };

  // Make the states available to all children components
  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}
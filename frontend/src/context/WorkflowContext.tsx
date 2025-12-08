import React, { createContext, useState, useEffect } from "react";

export type PassageId = `passage-${number}`;
export type CodeId = `code-${number}`;

// Base properties shared by all passages
interface BasePassage {
  id: PassageId; // A unique id consisting of "passage-" + an unique number (obtained from nextPassageId)
  order: number;
  text: string;
}

// Unhighlighted passage (no codes)
interface UnhighlightedPassage extends BasePassage {
  isHighlighted: false;
  codeIds: []; // No codes for unhighlighted passages
  codeSuggestions: []; // No code suggestions for unhighlighted passages
  autocompleteSuggestions: []; // No autocomplete suggestions for unhighlighted passages
  nextHighlightSuggestion: HighlightSuggestion | null;
}

// Highlighted passage (has codes and AI suggestions)
interface HighlightedPassage extends BasePassage {
  isHighlighted: true;
  codeIds: CodeId[];
  codeSuggestions: string[];
  autocompleteSuggestions: string[];
  nextHighlightSuggestion: null;
}

// Discriminated union
export type Passage = UnhighlightedPassage | HighlightedPassage;

export interface Code {
  id: CodeId; // A unique id consisting of "code-" + an unique number (obtained from nextCodeId)
  passageId: PassageId; // The id of the passage this code belongs to
  code: string;
}


export interface HighlightSuggestion {
  passage: string;
  startIndex: number;
  codes: string[];
}

export interface FewShotExample {
  passageId: PassageId;
  context: string;
  codedPassage: string;
  codes: string[];
}

export type PromptType = "highlight" | "code" | "autocomplete";

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

export const WorkflowContext = createContext<WorkflowContextType | undefined>(
  undefined
);

export interface WorkflowContextType {
  apiKey: string;
  setApiKey: Setter<string>;

  researchQuestions: string;
  setResearchQuestions: Setter<string>;

  contextInfo: string;
  setContextInfo: Setter<string>;

  codingGuidelines: string;
  setCodingGuidelines: Setter<string>;

  uploadedFile: File | null;
  setUploadedFile: Setter<File | null>;

  rawData: string;
  setRawData: Setter<string>;

  csvHeaders: string[] | null;
  setCsvHeaders: Setter<string[] | null>;

  parsedCSVdata: string[][];
  setParsedCSVdata: Setter<string[][]>;

  reviewedPromptType: PromptType;
  setReviewedPromptType: Setter<PromptType>;

  currentStep: number;
  setCurrentStep: Setter<number>;

  visitedSteps: Set<number>;
  setVisitedSteps: Setter<Set<number>>;

  proceedAvailable: boolean;
  setProceedAvailable: Setter<boolean>;

  passages: Passage[];
  setPassages: Setter<Passage[]>;

  passagesPerColumn: Map<number, Passage[]> | null;
  setPassagesPerColumn: Setter<Map<number, Passage[]> | null>;

  codes: Code[];
  setCodes: Setter<Code[]>;

  codebook: Set<string>;
  setCodebook: Setter<Set<string>>;

  nextCodeIdNumber: number;
  setNextCodeIdNumber: Setter<number>;

  nextPassageIdNumber: number;
  setNextPassageIdNumber: Setter<number>;

  activeCodeId: CodeId | null;
  setActiveCodeId: Setter<CodeId | null>;

  aiSuggestionsEnabled: boolean;
  setAiSuggestionsEnabled: Setter<boolean>;

  codeSuggestionContextWindowSize: number | null;
  setCodeSuggestionContextWindowSize: Setter<number | null>;

  highlightSuggestionContextWindowSize: number | null;
  setHighlightSuggestionContextWindowSize: Setter<number | null>;

  fewShotExamples: FewShotExample[];
  setFewShotExamples: Setter<FewShotExample[]>;

  fewShotExamplesSelectionMode: "random" | "manual";
  setFewShotExamplesSelectionMode: Setter<"random" | "manual">;

  randomFewShotExamplesCount: number;
  setRandomFewShotExamplesCount: Setter<number>;

  showCodingInstructionsOverlay: boolean;
  setShowCodingInstructionsOverlay: Setter<boolean>;
}

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  // Global configuration and information for prompts
  const [apiKey, setApiKey] = useState<string>("");
  const [researchQuestions, setResearchQuestions] = useState<string>("");
  const [contextInfo, setContextInfo] = useState<string>("");
  const [codingGuidelines, setCodingGuidelines] = useState<string>(""); // User-provided coding guidelines

  // Data upload states
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<string>("");
  const [csvHeaders, setCsvHeaders] = useState<string[] | null>(null);
  const [parsedCSVdata, setParsedCSVdata] = useState<string[][]>([]);

  // Prompt review states
  const [reviewedPromptType, setReviewedPromptType] = useState<PromptType>("highlight");

  // Workflow progression states
  const [currentStep, setCurrentStep] = useState<number>(1); // The current step of the workflow
  const [proceedAvailable, setProceedAvailable] = useState<boolean>(false); // Defines whether or not user can currently proceed to the next step
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([1])); // Steps that have been visited at least once. Used to freely allow moving between visited steps.

  // States for data coding
  const [passages, setPassages] = useState<Passage[]>([]); // The passages of the data coding phase
  const [passagesPerColumn, setPassagesPerColumn] = useState<Map<number, Passage[]> | null>(null);
  const [codes, setCodes] = useState<Code[]>([]); // The codes of the data coding phase (contains all code instances, even duplicates)
  const [codebook, setCodebook] = useState<Set<string>>(new Set()); // Contains all unique codes
  const [nextCodeIdNumber, setNextCodeIdNumber] = useState<number>(0); // Next unique id for a new code
  const [nextPassageIdNumber, setNextPassageIdNumber] = useState<number>(0); // Next unique id for a new passage
  const [activeCodeId, setActiveCodeId] = useState<CodeId | null>(null);
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState<boolean>(true); // Global toggle
  const [codeSuggestionContextWindowSize, setCodeSuggestionContextWindowSize] = useState<number | null>(
    200
  ); // Number of characters in the context window ffor code and autocomplete suggestions
  const [highlightSuggestionContextWindowSize, setHighlightSuggestionContextWindowSize] = useState<number | null>(
    600
  ); // Number of characters in the context window for highlight suggestions
  const [fewShotExamples, setFewShotExamples] = useState<FewShotExample[]>([]); // Few-shot examples for AI suggestions
  const [fewShotExamplesSelectionMode, setFewShotExamplesSelectionMode] = useState<"random" | "manual">("random");
  const [randomFewShotExamplesCount, setRandomFewShotExamplesCount] = useState<number>(10);
  const [showCodingInstructionsOverlay, setShowCodingInstructionsOverlay] = useState<boolean>(false);


  // Ensure that all the distinct codes in 'codes' are also in 'codebook'
  // However, this must not remove any codes that are in 'codebook' but not in 'codes'
  useEffect(() => {
    setCodebook((prev) => {
      const merged = new Set(prev);
      for (const c of codes) {
        const cleaned = c.code.split(/;/)[0].trim();
        if (cleaned) merged.add(cleaned);
      }
      return merged;
    });
  }, [codes]);

  // Ensure that fewShotExamples only contains examples for passages that still exist, and that it contains up-to-date codes
  useEffect(() => {
    setFewShotExamples((prev) => {
      const filtered = prev.filter((example) =>
        passages.some((p) => p.id === example.passageId)
      );
      // Ensure up-to-date codes for each example
      return filtered.map((example) => {
        const passage = passages.find((p) => p.id === example.passageId);
        if (!passage) return example; // Should not happen due to filtering above
        const exampleCodes = passage.codeIds.map((codeId) => 
          codes.find((c) => c.id === codeId)?.code || "").filter((c) => c !== "");
        return {
          ...example,
          codes: exampleCodes,
        };
      });
    });
  }, [codes, passages]);

  // On change of current step, mark it as visited
  useEffect(() => {
    setVisitedSteps((prev) => new Set(prev).add(currentStep));
  }, [currentStep]);


  // Combine all states + updaters into one object
  const value = {
    apiKey,
    setApiKey,
    researchQuestions,
    setResearchQuestions,
    contextInfo,
    setContextInfo,
    codingGuidelines,
    setCodingGuidelines,
    uploadedFile,
    setUploadedFile,
    rawData,
    setRawData,
    csvHeaders,
    setCsvHeaders,
    parsedCSVdata,
    setParsedCSVdata,
    reviewedPromptType,
    setReviewedPromptType,
    currentStep,
    setCurrentStep,
    proceedAvailable,
    setProceedAvailable,
    visitedSteps,
    setVisitedSteps,
    passages,
    setPassages,
    passagesPerColumn,
    setPassagesPerColumn,
    codes,
    setCodes,
    codebook,
    setCodebook,
    nextCodeIdNumber,
    setNextCodeIdNumber,
    nextPassageIdNumber,
    setNextPassageIdNumber,
    activeCodeId,
    setActiveCodeId,
    aiSuggestionsEnabled,
    setAiSuggestionsEnabled,
    codeSuggestionContextWindowSize,
    setCodeSuggestionContextWindowSize,
    highlightSuggestionContextWindowSize,
    setHighlightSuggestionContextWindowSize,
    fewShotExamples,
    setFewShotExamples,
    fewShotExamplesSelectionMode,
    setFewShotExamplesSelectionMode,
    randomFewShotExamplesCount,
    setRandomFewShotExamplesCount,
    showCodingInstructionsOverlay,
    setShowCodingInstructionsOverlay,
  };

  // Make the states available to all children components
  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

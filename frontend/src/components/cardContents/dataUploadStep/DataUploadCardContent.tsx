import { useContext, useState, useEffect, useRef } from "react";
import {
  FolderArrowDownIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";
import {
  Passage,
  PassageId,
  WorkflowContext,
} from "../../../context/WorkflowContext";
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import Button from "../../Button";
import InfoBox from "../../InfoBox";
import { parse } from "papaparse";
import CSVsettingsCard from "./CSVsettingsCard";
import OverlayWindow from "../../OverlayWindow";

const DataUploadCardContent = () => {
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle, loading, error, success
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showChangeFileConfirmation, setShowChangeFileConfirmation] = useState<boolean>(false);

  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("WorkflowContext must be used within a WorkflowProvider");
  }
  const {
    currentStep,
    csvHeaders,
    setCsvHeaders,
    setProceedAvailable,
    passages,
    setPassages,
    passagesPerColumn,
    setPassagesPerColumn,
    nextPassageIdNumber,
    setNextPassageIdNumber,
    uploadedFile,
    setUploadedFile,
    rawData,
    setRawData,
    parsedCSVdata,
    setParsedCSVdata,
    setCodes,
  } = context;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // When returning to this step, ensure that shown status is correct
  useEffect(() => {
    if (uploadedFile) {
      setUploadStatus("success");
    } else {
      setUploadStatus("idle");
    }
  }, [uploadedFile]);

  // Ensure the "Next" button is enabled on step 1 whenever a valid, fully-configured upload is present
  useEffect(() => {
    const canProceed =
      uploadedFile != null &&
      passages.length > 0 &&
      currentStep === 1 &&
      !errorMessage &&
      (uploadedFile.type !== "text/csv" || // If file is CSV, ensure header setting is chosen, and passagesPerColumn is set
        (csvHeaders !== null && passagesPerColumn && passagesPerColumn.size > 0)
      );

    setProceedAvailable(canProceed ?? false);
  }, [currentStep, uploadedFile, csvHeaders, errorMessage, passages, passagesPerColumn]);
  
  // Update state based on upload status
  useEffect(() => {
    if (uploadStatus === "success") {
      setErrorMessage(null);
      return;
    }
    if (uploadStatus === "loading") {
      setErrorMessage(null);
      return;
    }
    if (uploadStatus === "error") {
      // Reset state on error
      setUploadedFile(null);
      setPassages([]);
      setPassagesPerColumn(null);
      setCsvHeaders(null);
    }
  }, [uploadStatus]);

  // On rawData change, act accordingly based on file type
  useEffect(() => {
    if (!uploadedFile || !rawData) return; // Only continue if both are defined

    // If passages is already set, do not overwrite
    // This prevents losing the passages state if user returns to this step later
    if (passages.length > 0) return;

    if (uploadedFile.type === "text/plain") {
      setPassagesFromTextContent(rawData);
      setCsvHeaders([]); // Should be empty if not a CSV
      setUploadStatus("success");
    } else if (uploadedFile.type === "text/csv") {
      try {
        parseCSV(rawData);
      } catch (error: any) {
        setUploadStatus("error");
        setErrorMessage(error.message);
      }
    } else {
      setUploadStatus("error");
      setErrorMessage(
        "Unsupported file type. Please upload a .txt or .csv file."
      );
    }
  }, [rawData, uploadedFile]);

  // On parsedCSVdata change, update the passages and passagesPerColumn states
  useEffect(() => {
    if (!parsedCSVdata || parsedCSVdata.length === 0) return;

    // If passages already exist (user has been coding), don't regenerate
    if (passages.length > 0) return;

    setPassagesFromParsedCSV(parsedCSVdata);
  }, [parsedCSVdata]);

  /** Parses the raw CSV data string into the parsedCSVdata state using PapaParse.
   *
   * @param rawCSV The raw CSV data as a string
   */
  const parseCSV = (rawCSV: string) => {
    parse(rawCSV, {
      complete: (results) => {
        const parsedRawData = results.data as string[][];

        // Error: Empty file
        if (rawCSV.trim().length === 0) {
          throw new Error("CSV parsing error: Uploaded file is empty.");
        }

        // Error: No data parsed
        if (parsedRawData.length === 0) {
          throw new Error("CSV parsing error: Parsing returned no data.");
        }

        // Error: Missing quotes
        const hasMissingQuotes = results.errors.some(
          (e) => e.code === "MissingQuotes"
        );
        if (hasMissingQuotes) {
          throw new Error("CSV parsing error: Missing quotes detected. Ensure that all quoted fields are properly closed.");
        }

        // Error: Undetectable delimiter
        const singleColumn = parsedRawData.every((r) => r.length <= 1);
        const hasUndetectableDelimiter = results.errors.some(
          (e) => e.code === "UndetectableDelimiter"
        );
        if (hasUndetectableDelimiter && !singleColumn) {
          throw new Error(
            "CSV parsing error: Could not detect delimiter. (Recommended delimiters: commas or semicolons)."
          );
        }

        // Note: We ignore TooManyFields and TooFewFields errors here,
        // as they can be common in real-world CSVs and don't necessarily prevent parsing.

        // Success
        setParsedCSVdata(parsedRawData);
        setPassagesFromParsedCSV(parsedRawData);
      },
    });
  };

  const setPassagesFromParsedCSV = (parsedCSVdata: string[][]) => {
    // Determine starting row based on whether CSV has headers
    const startingRow = csvHeaders && csvHeaders.length > 0 ? 1 : 0;

    let newPassagesPerColumn: Map<number, Passage[]> = new Map();
    let idCounter = nextPassageIdNumber;

    for (let colIndex = 0; colIndex < parsedCSVdata[0].length; colIndex++) {
      const passagesForThisColumn: Passage[] = [];

      for (
        let rowIndex = startingRow;
        rowIndex < parsedCSVdata.length;
        rowIndex++
      ) {
        const cellContent = parsedCSVdata[rowIndex][colIndex];
        // Skip empty cells
        if (!cellContent || cellContent.trim().length === 0) continue;

        const passageId = `passage-${idCounter++}` as PassageId;
        const newPassage: Passage = {
          id: passageId,
          order: startingRow === 0 ? rowIndex : rowIndex - 1,
          text: cellContent.trim() + "\u001E", // Append record separator to denote end of row for LLM
          isHighlighted: false,
          codeIds: [],
          codeSuggestions: [],
          autocompleteSuggestions: [],
          nextHighlightSuggestion: null,
        };
        passagesForThisColumn.push(newPassage);
      }

      newPassagesPerColumn.set(colIndex, passagesForThisColumn);
    }

    setUploadStatus("success")
    setPassagesPerColumn(newPassagesPerColumn);
    setPassages(newPassagesPerColumn.get(0) || []); // Default to first column
    setNextPassageIdNumber(idCounter);
  };

  const setPassagesFromTextContent = (textContent: string) => {
    setPassages([
      {
        id: `passage-0` as PassageId,
        order: 0,
        text: textContent,
        isHighlighted: false,
        codeIds: [],
        codeSuggestions: [],
        autocompleteSuggestions: [],
        nextHighlightSuggestion: null,
      },
    ]);
    setNextPassageIdNumber(1);
    setUploadStatus("success");
    return;
  };

  /** Trigger file input click */
  const handleBrowseButtonClick = () => {
    fileInputRef.current?.click();
  };

  /** Handle a change in the file input. Reads the selected file and updates rawData state.
   *
   * @param e the change event from the file input
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files && e.target.files[0];

    if (selectedFile) {
      const reader = new FileReader();

      reader.onloadstart = () => {
        // Reset states on new file selection
        setUploadStatus("loading");
        setUploadedFile(null);
        setCsvHeaders(null);
        setErrorMessage(null);
        setPassages([]);
        setPassagesPerColumn(null);
        setCodes([]);
        setProceedAvailable(false);
      };

      reader.onload = () => {
        const content = reader.result;
        if ((content as string).trim().length === 0) {
          setUploadStatus("error");
          setErrorMessage("Uploaded file is empty");
          return;
        }
        setUploadedFile(selectedFile);
        setRawData(content as string);
      };

      reader.onerror = () => {
        console.error("Error reading file: ", reader.error);
        setUploadStatus("error");
        setErrorMessage(
          `Failed to read file: ${reader.error?.message || "Unknown error"}`
        );
      };

      // Start reading the content of the file
      reader.readAsText(selectedFile);
    }
  };

  return (
    <div className="flex flex-col gap-6 items-center">
      <p className="text-center">
        Upload your data either as a text (.txt) file or in CSV format.
      </p>
      <input
        ref={fileInputRef}
        id="file-input"
        type="file"
        accept="text/plain, text/csv"
        onChange={handleFileChange}
        className="hidden"
      />
      {uploadStatus !== "idle" && (
        <div className="">
          <InfoBox
            msg={
              uploadStatus === "error"
                ? errorMessage || "Error uploading file. Please try again."
                : uploadStatus === "loading"
                ? "Loading file..."
                : uploadStatus === "success"
                ? "File upload succeeded"
                : ""
            }
            variant={
              uploadStatus === "error"
                ? "error"
                : uploadStatus === "loading"
                ? "loading"
                : uploadStatus === "success"
                ? "success"
                : "neutral"
            }
            icon={
              uploadStatus === "error"
                ? ExclamationTriangleIcon
                : uploadStatus === "success"
                ? CheckCircleIcon
                : undefined
            }
          />
        </div>
      )}
      <div className="flex flex-col gap-2 w-full">
        {uploadedFile && uploadStatus === "success" && (
          <div className="flex gap-2 justify-center -mt-1">
            <p>Uploaded file:</p>
            <i>{uploadedFile.name}</i>
          </div>
        )}
        {uploadedFile &&
          uploadedFile.type === "text/csv" &&
          uploadStatus === "success" && (
            <CSVsettingsCard
              parsedCSV={parsedCSVdata}
              csvHeaders={csvHeaders}
              setCsvHeaders={setCsvHeaders}
            />
          )}
      </div>
      <div className={!uploadedFile ? "-mt-6" : ""}>
        <Button
          label={uploadedFile ? "Change file" : "Browse files"}
          onClick={() => {
            uploadedFile 
              ? setShowChangeFileConfirmation(true) 
              : handleBrowseButtonClick()
          }}
          icon={uploadedFile ? ArrowsRightLeftIcon : FolderArrowDownIcon}
          iconPosition="start"
          variant="tertiary"
        />
      </div>
      <OverlayWindow isVisible={showChangeFileConfirmation} onClose={() => setShowChangeFileConfirmation(false)} maxWidth="max-w-[60vw]" maxHeight="max-h-[60vh]">
        <div className="flex flex-col items-center p-8">
          <div className="flex flex-col gap-2 items-center pb-6">
            <p className="font-semibold">Are you sure you want to select a new file for coding?</p>
            <p>You will lose your current coding progress.</p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              label="Cancel"
              onClick={() => setShowChangeFileConfirmation(false)}
              variant="outlineTertiary"
            />
            <Button
              label="Yes, change file"
              onClick={() => {
                setShowChangeFileConfirmation(false);
                handleBrowseButtonClick();
              }}
              variant="tertiary"
            />
          </div>
        </div>
      </OverlayWindow>
    </div>
  );
};

export default DataUploadCardContent;

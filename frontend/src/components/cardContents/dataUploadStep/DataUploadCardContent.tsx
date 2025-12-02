import { useContext, useState, useEffect, useRef } from "react";
import {
  FolderArrowDownIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";
import { CodingData, Passage, PassageId, WorkflowContext } from "../../../context/WorkflowContext";
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import Button from "../../Button";
import InfoBox from "../../InfoBox";
import { parse } from "papaparse";
import CSVsettingsCard from "./CSVsettingsCard";

const DataUploadCardContent = () => {
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle, loading, error, success
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCsvParsingInteraction, setShowCsvParsingInteraction] =
    useState(false);
  const [selectedCsvColIndex, setSelectedCsvColIndex] = useState<number | null>(
    null
  );
  const [selectedCsvColName, setSelectedCsvColName] = useState<string | null>(null);
  const [csvHasHeaders, setCsvHasHeaders] = useState<boolean>(false);

  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("WorkflowContext must be used within a WorkflowProvider");
  }
  const { currentStep, setData, setProceedAvailable, passages, setPassages, setNextPassageIdNumber, uploadedFile, setUploadedFile } = context;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const parsedCSVdataRef = useRef<string[][] | null>(null);

  // Make sure next button is available if the user returns to this screen when data has already been uploaded
  useEffect(() => {
    passages.length > 0 && currentStep === 1 ? setProceedAvailable(true) : null;
  }, [currentStep]);

  // Update state based on upload status
  useEffect(() => {
    if (uploadStatus === "success") {
      setErrorMessage(null);
      setProceedAvailable(true);
      return;
    }
    if (uploadStatus === "loading") {
      setErrorMessage(null);
      setProceedAvailable(false);
      setShowCsvParsingInteraction(false); 
      return;
    }
    if (uploadStatus === "error") {
      setProceedAvailable(false);
      setShowCsvParsingInteraction(false);
      // Reset file on error
      setUploadedFile(null);
    }
  }, [uploadStatus]);

  // On change of selected CSV column or csvHasHeaders, update the passages state
  useEffect(() => {
    if (selectedCsvColIndex === null || !parsedCSVdataRef.current) return;
    const colValues = parsedCSVdataRef.current.map((row) => {
      // If the row is missing the selected column, skip it
      if (selectedCsvColIndex >= row.length) return "";
      return row[selectedCsvColIndex];
    });
    const filtered = colValues.filter((val) => val !== ""); // Remove empty strings
    setPassagesFromCSV(filtered);
  }, [selectedCsvColIndex, csvHasHeaders]);

  // On successful file upload
  const parseCSV = (rawCSV: string) => {
    if (rawCSV?.trim().length === 0) {
      setUploadStatus("error");
      setErrorMessage("Uploaded file is empty");
      return;
    }

    parse(rawCSV, {
      complete: (results) => {
        const parsedRawData = results.data as string[][];

        // Error: Empty file
        if (rawCSV.trim().length === 0) {
          setUploadStatus("error");
          setErrorMessage("CSV parsing error: Uploaded file is empty.");
          return;
        }

        // Error: No data parsed
        if (parsedRawData.length === 0) {
          setUploadStatus("error");
          setErrorMessage("CSV parsing error: Parsing returned no data.");
          return;
        }

        // Error: Undetectable delimiter
        const singleColumn = parsedRawData.every(r => r.length <= 1);
        const hasUndetectableDelimiter = results.errors.some(e => e.code === "UndetectableDelimiter");
        if (hasUndetectableDelimiter && !singleColumn) {
          setUploadStatus("error");
          setErrorMessage("CSV parsing error: Could not detect delimiter. (Recommended delimiters: commas or semicolons).");
          return;
        }

        // Error: Missing quotes
        const hasMissingQuotes = results.errors.some(e => e.code === "MissingQuotes");
        if (hasMissingQuotes) {
          setUploadStatus("error");
          setErrorMessage("CSV parsing error: Missing quotes detected.");
          return;
        }

        // Success (possible recoverable parsing warnings are ignored)
        parsedCSVdataRef.current = parsedRawData;
        setShowCsvParsingInteraction(true);
        if (results.errors.length === 0) setUploadStatus("success");
        setProceedAvailable(true);
      },
    });
  };

  const setPassagesFromCSV = (colValues: string[]) => {
    const filteredColValues = colValues.filter((val) => val !== ""); // Remove empty strings
    const newPassages = filteredColValues.map((text, index) => ({
      id: `passage-${index}` as PassageId,
      order: index,
      text: text.trim() + "\u001E", // Append record separator to each CSV row to help LLMs distinguish rows
      isHighlighted: false,
      codeIds: [],
      codeSuggestions: [],
      autocompleteSuggestions: [],
      nextHighlightSuggestion: null,
      originalParentOrder: index,
    } as Passage));
    setPassages(newPassages);
    setNextPassageIdNumber(newPassages.length);
    setData({ data: filteredColValues, hasHeaders: csvHasHeaders } as CodingData);
  }


  const setPassagesFromTextContent = (textContent: string) => {
    if (textContent?.trim().length === 0) {
      setUploadStatus("error");
      setErrorMessage("Uploaded file is empty");
      return;
    }

    setData({ data: textContent } as CodingData);
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
  }

  /** Trigger file input click */
  const handleBrowseButtonClick = () => {
    fileInputRef.current?.click();
  };

  /** Handle a change in the file input
   *
   * @param e the change event from the file input
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files && e.target.files[0];

    if (selectedFile) {
      const reader = new FileReader();

      reader.onloadstart = () => {
        setUploadStatus("loading");
      };

      reader.onload = () => {
        const content = reader.result;
        setUploadedFile(selectedFile);
        if (selectedFile.type === "text/plain") {
          setUploadStatus("success");
          setPassagesFromTextContent(content as string);
          return;
        }
        if (selectedFile.type === "text/csv") {
          setUploadStatus("idle"); // Reset status to idle before showing CSV parsing interaction
          parseCSV(content as string);
          return;
        }
      };

      reader.onerror = () => {
        console.error("Error reading file: ", reader.error);
        setProceedAvailable(false);
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
      {uploadedFile && !errorMessage && !showCsvParsingInteraction && (
        <div className="flex gap-6 justify-between -mt-1">
          <p>Uploaded file:</p>
          <i>{uploadedFile.name}</i>
        </div>
      )}
      {showCsvParsingInteraction && uploadedFile && parsedCSVdataRef.current && (
        <div className="">
          <CSVsettingsCard
            file={uploadedFile}
            parsedCSV={parsedCSVdataRef.current}
            csvHasHeaders={csvHasHeaders}
            setCsvHasHeaders={setCsvHasHeaders}
            selectedCsvColIndex={selectedCsvColIndex}
            setSelectedCsvColIndex={setSelectedCsvColIndex}
            selectedCsvColName={selectedCsvColName}
            setSelectedCsvColName={setSelectedCsvColName}
          />
        </div>
      )}
      <Button
        label={uploadedFile ? "Change file" : "Browse files"}
        onClick={handleBrowseButtonClick}
        icon={
          uploadedFile
            ? ArrowsRightLeftIcon
            : FolderArrowDownIcon
        }
        iconPosition="start"
        variant="tertiary"
      />
    </div>
  );
};

export default DataUploadCardContent;

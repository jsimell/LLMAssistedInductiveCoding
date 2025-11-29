import { useContext, useState, useEffect, useRef } from "react";
import {
  FolderArrowDownIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";
import { CodingData, PassageId, WorkflowContext } from "../../../context/WorkflowContext";
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import Button from "../../Button";
import InfoBox from "../../InfoBox";
import { parse } from "papaparse";
import SelectCSVColumnInteraction from "./SelectCSVColumnInteraction";

const DataUploadCardContent = () => {
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle, loading, error, success
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCsvParsingInteraction, setShowCsvParsingInteraction] =
    useState(false);
  const [selectedCsvColumn, setSelectedCsvColumn] = useState<string | null>(
    null
  );

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

  // Proceed should never be available if CSV parsing interaction is shown
  useEffect(() => {
    if (showCsvParsingInteraction) {
      setProceedAvailable(false);
    }
  }, [showCsvParsingInteraction]);

  // Update state based on upload status
  useEffect(() => {
    if (uploadStatus === "success") {
      setErrorMessage(null);
      setProceedAvailable(true);
      setShowCsvParsingInteraction(false);
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

  // On successful file upload
  const setInitialPassagesFromCSV = (rawCSV: string) => {
    if (rawCSV?.trim().length === 0) {
      setUploadStatus("error");
      setErrorMessage("Uploaded file is empty");
      return;
    }

    parse(rawCSV, {
      complete: (results) => {
        const parsedRawData = results.data as string[][];
        if (parsedRawData.length === 0) {
          setUploadStatus("error");
          setErrorMessage("CSV parsing error: Parsing returned no data.");
          return;
        }
        parsedCSVdataRef.current = parsedRawData;
        setShowCsvParsingInteraction(true);
      },
    });
  };

  const setInitialPassageFromTextContent = (textContent: string) => {
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
          setInitialPassageFromTextContent(content as string);
        }
        if (selectedFile.type === "text/csv") {
          setUploadStatus("idle"); // Reset status to idle before showing CSV parsing interaction
          setInitialPassagesFromCSV(content as string);
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

  /** Handle CSV parsing interaction finish */
  const handleColumnSelectionFinish = (
    parsedData?: string[],
    errorMessage?: string
  ) => {
    if (!parsedData && !errorMessage) {
      console.error(
        "CSV parsing interaction returned nothing: either parsedData or errorMessage must be provided"
      );
    }
    if (errorMessage) {
      setUploadStatus("error");
      setErrorMessage(errorMessage);
      return;
    } 
    if (parsedData) {
      setData({ data: parsedData });
      setPassages(() => {
        return parsedData.map((csvEntry, index) => ({
          id: 'passage-' + index as PassageId,
          order: index,
          text: csvEntry,
          isHighlighted: false,
          codeIds: [],
          codeSuggestions: [],
          autocompleteSuggestions: [],
          nextHighlightSuggestion: null,
        }));
      });
      setNextPassageIdNumber(parsedData.length); // Must not forget to update the passage ID counter
      setUploadStatus("success");
    }
  };

  const cancelCsvParsing = () => {
    setShowCsvParsingInteraction(false);
    setUploadedFile(null);
    setUploadStatus("idle");
  };

  return (
    <div className="flex flex-col items-center">
      {!showCsvParsingInteraction && 
        <p className="pb-6">
          Upload your data either as a text (.txt) file or in CSV format.
        </p>
      }
      <input
        ref={fileInputRef}
        id="file-input"
        type="file"
        accept="text/plain, text/csv"
        onChange={handleFileChange}
        className="hidden"
      />
      {uploadStatus !== "idle" && (
        <div className="pb-4">
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
      <div className="flex flex-col pb-6 w-[80%]">
        {uploadedFile && !showCsvParsingInteraction && !errorMessage && (
          <div className="flex gap-6 justify-between">
            <p>Uploaded file:</p>
            <i>{uploadedFile.name}</i>
          </div>
        )}
        {uploadedFile?.type === "text/csv" && !showCsvParsingInteraction && !errorMessage && (
          <div className="flex gap-6 pt-1 justify-between">
            <p>Selected CSV column:</p>
            <i>{selectedCsvColumn}</i>
          </div>
        )}
      </div>
      {!showCsvParsingInteraction && (
        <Button
          label={uploadStatus === "success" ? "Change file" : "Browse files"}
          onClick={handleBrowseButtonClick}
          icon={
            uploadStatus === "success"
              ? ArrowsRightLeftIcon
              : FolderArrowDownIcon
          }
          iconPosition="start"
          variant="tertiary"
        />
      )}
      {showCsvParsingInteraction && uploadedFile && parsedCSVdataRef.current && (
        <SelectCSVColumnInteraction
          onFinish={handleColumnSelectionFinish}
          onCancel={cancelCsvParsing}
          file={uploadedFile}
          parsedCSV={parsedCSVdataRef.current}
          selectedCsvColumn={selectedCsvColumn}
          setSelectedCsvColumn={setSelectedCsvColumn}
          setShowCsvParsingInteraction={setShowCsvParsingInteraction}
        />
      )}
    </div>
  );
};

export default DataUploadCardContent;

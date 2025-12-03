import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { WorkflowContext } from "../../../context/WorkflowContext";
import CodeBookRow from "./CodeBookRow";
import { ArrowDownTrayIcon, XMarkIcon } from "@heroicons/react/24/outline";
import SmallButton from "../../SmallButton";
import { parse } from "papaparse";
import OverlayWindow from "../../OverlayWindow";
import { getPassageWithSurroundingContext } from "./utils/passageUtils";
import CodeSummaryWindowContent from "./CodeSummaryWindowContent";

interface CodebookProps {
  codeManager: {
    editAllInstancesOfCode: (oldValue: string, newValue: string) => void;
  };
}

const Codebook = ({ codeManager }: CodebookProps) => {
  const [rawImportContent, setRawImportContent] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCodeSummaryFor, setShowCodeSummaryFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { codebook, setCodebook, codes, passages, uploadedFile } = useContext(WorkflowContext)!;

  const dataIsCSV = (uploadedFile && uploadedFile.type === "text/csv") ?? false;

  const getCodeCount = (code: string) => {
    return codes.filter((c) => c.code === code).length;
  };

  const codebookArray = useMemo(() => {
    return Array.from(codebook)
      .filter((code) => code ? code.trim().length > 0 : false)
      .sort((a, b) => getCodeCount(b) - getCodeCount(a));
  }, [codebook, codes]); // Only re-sort when codebook or codes change

  const usedCodes = useMemo(() => {
    return codebookArray.filter(c => getCodeCount(c) > 0);
  }, [codebookArray]);

  const unusedCodes = useMemo(() => {
    return codebookArray.filter(c => getCodeCount(c) === 0);
  }, [codebookArray]);

  // When rawImportContent appears, parse it and update the codebook
  useEffect(() => {
    if (rawImportContent) {

      parse<string[]>(rawImportContent, {
        complete: (results) => {
          // Error: Missing quotes
          const hasMissingQuotes = results.errors.some(e => e.code === "MissingQuotes");
          if (hasMissingQuotes) {
            setErrorMessage("CSV parsing error: Missing quotes detected.");
            return;
          }
          
          const isMultiColumn = results.data.some(row => {
            const nonEmpty = row.filter(c => (c ?? "").trim().length > 0);
            return nonEmpty.length > 1;
          });

          // Error: Multi-column file
          if (isMultiColumn) {
            setErrorMessage("Invalid codebook: file must be a single column (one code per row, no header).");
            return;
          }

          const importedCodes = results.data
            .map((row) => row[0]?.trim())
            .filter((code) => code && code.length > 0);

          // Error: File is empty
          if (rawImportContent.trim().length === 0 || importedCodes.length === 0) {
            setErrorMessage("The imported file does not contain any codes.");
            return;
          }

          // Success - update codebook
          setCodebook(new Set(importedCodes));
        }
      });
    }
  }, [rawImportContent]);

  const handleImportButtonClick = () => {
    setErrorMessage(null); // Reset possible previous error message
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files && e.target.files[0];

    if (selectedFile) {
      const reader = new FileReader();

      reader.onload = () => {
        const content = reader.result;
        setRawImportContent(content as string);
      };

      reader.onerror = () => {
        console.error("Error reading imported codebook: ", reader.error);
        setErrorMessage(
          `Failed to read file: ${reader.error?.message || "Unknown error"}`
        );
      };

      // Start reading the content of the file
      reader.readAsText(selectedFile);
    }
  };

  return (
    <div className="flex flex-col items-center w-full h-fit rounded-lg border-1 border-outline">
      <div className="flex h-fit w-full items-center justify-center px-4.5 pt-4 pb-3.5 border-b border-outline rounded-t-lg bg-container text-primary">
        <p className="text-lg font-semibold">Codebook</p>
      </div>
      <div className="flex flex-col w-full px-6 py-4 items-center">
        {codebookArray.length === 0 && 
          <div className="flex flex-col items-center gap-3 pb-1.5">
            <p className="max-w-[60%] text-center">Add codes by highlighting passages in the data.</p>
            <p>OR</p>
            <p className="text-center pb-2">Import a codebook from a CSV file (no header, single column: one code per row).</p>
            <SmallButton
              label="Import codebook"
              onClick={handleImportButtonClick}
              icon={ArrowDownTrayIcon}
              variant={"tertiary"}
            />
            {errorMessage && <p className="text-red-500 text-center">{errorMessage}</p>}
            <input
              type="file"
              accept=".csv,text/csv"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        }
        {usedCodes.map((code) => (
          <CodeBookRow key={code} code={code} codeManager={codeManager} count={getCodeCount(code)} setShowCodeSummaryFor={setShowCodeSummaryFor}  />
        ))}
        {unusedCodes.length > 0 && <p className="self-start pb-1 pt-4 font-medium">Unused codes:</p>}
        {codebookArray.filter(c => getCodeCount(c) === 0).map((code) => (
          <CodeBookRow key={code} code={code} codeManager={codeManager} count={getCodeCount(code)} setShowCodeSummaryFor={setShowCodeSummaryFor} />
        ))}
      </div>
      <OverlayWindow isVisible={showCodeSummaryFor !== null} onClose={() => setShowCodeSummaryFor(null)} maxWidth="max-w-[60vw]" maxHeight="max-h-[60vh]">
        <CodeSummaryWindowContent 
          showCodeSummaryFor={showCodeSummaryFor} 
          setShowCodeSummaryFor={setShowCodeSummaryFor} 
          dataIsCSV={dataIsCSV} 
        />
      </OverlayWindow>
    </div>
  );
};

export default Codebook;
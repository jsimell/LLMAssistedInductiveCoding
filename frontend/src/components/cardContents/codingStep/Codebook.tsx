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

  const handleCodebookDownload = () => {
    const csvContent = Array.from(codebook)
      .filter((code) => code ? code.trim().length > 0 : false)
      .map((code) => `${code}\n`)
      .join("");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "codebook.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col sticky top-31 items-center w-full h-fit rounded-lg border-1 border-outline">
      <div className="flex h-fit w-full items-center px-3 pt-2.5 pb-2 border-b border-outline rounded-t-lg bg-container text-primary">
        <div className="grow"></div>
        <p className="text-lg font-semibold">Codebook</p>
        <div className="grow flex justify-end items-center">
          <ArrowDownTrayIcon 
            className="size-5.5 stroke-2 cursor-pointer text-primary hover:bg-primary/20 rounded-sm" 
            onClick={handleCodebookDownload}
          />
        </div>
      </div>
      <div className="flex flex-col w-full p-6 items-center">
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
        {usedCodes.map((code, index) => {
          return (
            <>
              <CodeBookRow key={code} code={code} codeManager={codeManager} count={getCodeCount(code)} setShowCodeSummaryFor={setShowCodeSummaryFor}  />
              {index === usedCodes.length - 1 && unusedCodes.length > 0 ? <div className="pb-4"></div> : <></>}
            </>
          );
        })}
        {unusedCodes.length > 0 && <p className="self-start pb-1 font-medium">Unused codes:</p>}
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
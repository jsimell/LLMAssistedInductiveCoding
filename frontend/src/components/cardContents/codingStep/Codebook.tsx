import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { WorkflowContext } from "../../../context/WorkflowContext";
import CodeBookRow from "./CodeBookRow";
import { ArrowDownTrayIcon, PlusIcon } from "@heroicons/react/24/outline";
import SmallButton from "../../SmallButton";
import { parse } from "papaparse";
import OverlayWindow from "../../OverlayWindow";
import { getPassageWithSurroundingContext } from "./utils/passageUtils";
import CodeSummaryWindowContent from "./CodeSummaryWindowContent";
import { DocumentArrowDownIcon } from "@heroicons/react/24/solid";

interface CodebookProps {
  codeManager: {
    editAllInstancesOfCode: (oldValue: string, newValue: string) => void;
  };
}

const Codebook = ({ codeManager }: CodebookProps) => {
  const [rawImportContent, setRawImportContent] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCodeSummaryFor, setShowCodeSummaryFor] = useState<string | null>(null);
  const [showAddCodeInteraction, setShowAddCodeInteraction] = useState<boolean>(false);
  const [newCodeInput, setNewCodeInput] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { codebook, importedCodes, setImportedCodes, codes, uploadedFile } = useContext(WorkflowContext)!;

  const dataIsCSV = (uploadedFile && uploadedFile.type === "text/csv") ?? false;

  const getCodeCount = (code: string) => {
    return codes.filter((c) => c.code === code).length;
  };

  const codebookArray = useMemo(() => {
    return Array.from(codebook)
      .filter((code) => code ? code.trim().length > 0 : false)
      .sort((a, b) => getCodeCount(b) - getCodeCount(a));
  }, [codebook, codes]); // Only re-sort when codebook or codes change

  const importedCodesArray = useMemo(() => {
    return Array.from(importedCodes)
      .filter((code) => code ? code.trim().length > 0 : false)
      .sort((a, b) => getCodeCount(b) - getCodeCount(a));
  }, [importedCodes]);

  // When rawImportContent changes, parse it and update the imported codes state
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

          const imported = results.data
            .map((row) => row[0]?.trim())
            .filter((code) => code && code.length > 0);

          // Error: File is empty
          if (rawImportContent.trim().length === 0 || imported.length === 0) {
            setErrorMessage("The imported file does not contain any codes.");
            return;
          }

          // Success - update codebook
          setImportedCodes(new Set(imported));
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

  const handleAddNewCode = () => {
    const trimmedCode = newCodeInput.trim();
    if (trimmedCode.length === 0 || codebook.has(trimmedCode) || importedCodes.has(trimmedCode)) {
      setShowAddCodeInteraction(false);
      setNewCodeInput("");
      return; // Do not add empty codes
    }
    setImportedCodes(new Set([...importedCodes, trimmedCode]));
    setShowAddCodeInteraction(false);
    setNewCodeInput("");
  };

  return (
    <div className="flex flex-col sticky top-31 items-center w-full h-fit rounded-lg border-1 border-outline max-h-[84vh]">
      <div className="flex h-fit w-full items-center px-3 pt-2.5 pb-2 border-b border-outline rounded-t-lg bg-container text-primary">
        <div className="grow"></div>
        <p className="text-lg font-semibold">Codebook</p>
        <div className="grow flex justify-end items-center">
          <ArrowDownTrayIcon
            className="size-5.5 stroke-2 cursor-pointer text-[#08497a] hover:bg-primary/12 rounded-sm" 
            onClick={handleCodebookDownload}
          />
        </div>
      </div>
      <div className="flex flex-col w-full p-6 items-center overflow-y-auto">
        {codebookArray.length + importedCodesArray.length === 0 && 
          <div className="flex flex-col items-center gap-3 pb-1.5">
            <p className="max-w-[60%] text-center">Add codes by highlighting passages in the data.</p>
            <p>OR</p>
            <p className="text-center pb-2">Import a codebook from a CSV file (no header, single column: one code per row).</p>
            <SmallButton
              label="Import codebook"
              onClick={handleImportButtonClick}
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
        {codebookArray.map((code, index) => {
          return (
            <div key={code} className="w-full">
              <CodeBookRow code={code} codeManager={codeManager} count={getCodeCount(code)} setShowCodeSummaryFor={setShowCodeSummaryFor}  />
              {index === codebookArray.length - 1 && importedCodesArray.length > 0 ? <div className="pb-4"></div> : <></>}
            </div>
          );
        })}
        {importedCodesArray.length > 0 && <p className="self-start pb-1 font-medium">Unused/imported codes:</p>}
        {importedCodesArray.map((code) => (
          <CodeBookRow key={code} code={code} codeManager={codeManager} count={getCodeCount(code)} setShowCodeSummaryFor={setShowCodeSummaryFor} />
        ))}
        {importedCodesArray.length + codebookArray.length > 0 && !showAddCodeInteraction &&
          <div className="pt-3 w-full flex justify-center">
            <PlusIcon
              className="size-5.5 stroke-2 cursor-pointer text-[#08497a] hover:bg-primary/10 rounded-sm" 
              onClick={() => setShowAddCodeInteraction(true)}
            />
          </div>
        }
        {showAddCodeInteraction && (
          <div className="mt-4 w-full flex items-center justify-center gap-2">
            <input
              type="text"
              value={newCodeInput}
              onChange={(e) => setNewCodeInput(e.target.value)}
              placeholder="Enter new code"
              className="w-3/4 px-3 py-1 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex py-1 gap-2">
              <SmallButton
                label="Cancel"
                onClick={() => {
                  setShowAddCodeInteraction(false);
                  setNewCodeInput("");
                }}
                variant="outlinePrimary"
              />
              <SmallButton
                label="Add"
                onClick={handleAddNewCode}
                variant="primary"
              />
            </div>
          </div>
        )}
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
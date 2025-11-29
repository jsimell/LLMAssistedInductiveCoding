import { useState, useEffect, useContext } from "react";
import Button from "../../Button";
import { WorkflowContext } from "../../../context/WorkflowContext";

interface SelectCSVColumnInteractionProps {
  onFinish: (parsedData?: string[], errorMessage?: string) => void;
  onCancel: () => void;
  file: File;
  parsedCSV: string[][];
  selectedCsvColumn: string | null;
  setSelectedCsvColumn: React.Dispatch<React.SetStateAction<string | null>>;
  setShowCsvParsingInteraction: React.Dispatch<React.SetStateAction<boolean>>;
}

const SelectCSVColumnInteraction = ({ onFinish, onCancel, file, parsedCSV, selectedCsvColumn, setSelectedCsvColumn, setShowCsvParsingInteraction }: SelectCSVColumnInteractionProps) => {
  const [hasHeaders, setHasHeaders] = useState<boolean>(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [selectedColIndex, setSelectedColIndex] = useState<number | null>(null);

  // Update headers when hasHeaders is set to true
  useEffect(() => {
    if (hasHeaders) {
      const headers = parsedCSV[0];
      setCsvHeaders(headers);
      // If a column was previously selected, update selectedCsvColumn accordingly
      if (selectedColIndex !== null && selectedColIndex < headers.length) {
        setSelectedCsvColumn(headers[selectedColIndex]);
      } else {
        setSelectedCsvColumn(headers[0]);
        setSelectedColIndex(0);
      }
    } else {
      // No headers, create generic column names
      const numCols = parsedCSV[0].length;
      const genericHeaders = Array.from({ length: numCols }, (_, i) => `Column ${i + 1}`);
      setCsvHeaders(genericHeaders);
      // If a column was previously selected, update selectedCsvColumn accordingly
      if (selectedColIndex !== null && selectedColIndex < numCols) {
        setSelectedCsvColumn(`Column ${selectedColIndex + 1}`);
      } else {
        setSelectedCsvColumn("Column 1");
        setSelectedColIndex(0);
      }
    }
  }, [hasHeaders]);

  const extractSelectedColumnData = () => {
    const colValues = parsedCSV.map((row, rowIndex) => {
      // Skip header row if hasHeaders is true
      if (hasHeaders && rowIndex === 0) return "";
      // If the row is missing the selected column, skip it
      if (selectedColIndex === null || selectedColIndex >= row.length) return "";
      return row[selectedColIndex];
    });
    return colValues.filter((val) => val !== ""); // Remove empty strings
  }

  return (
    <div className="flex flex-col items-center gap-5 border border-outline pt-4.5 pb-5.5 px-6 rounded-lg">
      <div className="flex flex-col w-full items-start">
        <p className="text-lg font-semibold mb-3">CSV Parsing</p>
        <p>Uploaded file: </p><i>{file.name}</i>
      </div>
      <form className="flex flex-col gap-4">
        <div className="flex gap-6 justify-between items-center">
          <label>Does the first row of your CSV file contain headers?</label>
          <div className="flex gap-2">
            <label>Yes</label>
            <input className="mr-1" type="radio" name="headerQuery" value="yes" checked={hasHeaders} onChange={() => setHasHeaders(true)} />
            <label>No</label>
            <input type="radio" name="headerQuery" value="no" checked={!hasHeaders} onChange={() => setHasHeaders(false)} />
          </div>
        </div>
        <div className="flex justify-between items-center gap-6">
          <label>Select the column that contains the data to code:</label>
          <select 
            className="border border-outline bg-background rounded p-1"
            value={selectedCsvColumn ?? "No selection"}
            onChange={(e) => {
              setSelectedCsvColumn(e.target.value);
              e.target.selectedIndex !== -1 && setSelectedColIndex(e.target.selectedIndex);
            }}
          >
            {hasHeaders ? csvHeaders.map((colName) => {
              return <option key={colName} value={colName}>{colName.length > 30 ? colName.slice(0, 40).trim() + "..." : colName}</option>
            })
            : Array.from({ length: csvHeaders.length }, (_, i) => i).map((colIndex) => (
              <option key={colIndex} value={`Column ${colIndex + 1}`}>Column {colIndex + 1}</option>
            ))
            }
          </select>
        </div>
      </form>
      <div className="flex justify-center gap-2">
        <Button 
          label="Cancel"
          onClick={() => {
            // First, reset states (both local and parent)
            setHasHeaders(false);
            setCsvHeaders([]);
            setSelectedColIndex(null);
            setSelectedCsvColumn(null);
            setShowCsvParsingInteraction(false);
            // Then, call onCancel to notify parent, which hides this interaction
            onCancel();
          }}
          variant="outlineTertiary"
        />
        <Button 
          label="Confirm"
          onClick={() => {
            const extractedData = extractSelectedColumnData();
            if (extractedData.length === 0) {
              onFinish(undefined, "CSV parsing error: Unknown parsing error.");
            } else {
              onFinish(extractedData);
            }
          }}
          variant="tertiary"
        />
      </div>
    </div>
  );
}

export default SelectCSVColumnInteraction;
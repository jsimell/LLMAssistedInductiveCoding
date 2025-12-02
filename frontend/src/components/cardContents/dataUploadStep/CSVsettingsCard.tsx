import { useState, useEffect, useContext } from "react";
import { WorkflowContext } from "../../../context/WorkflowContext";

interface CSVsettingsCardProps {
  file: File;
  parsedCSV: string[][];
  csvHasHeaders: boolean;
  setCsvHasHeaders: React.Dispatch<React.SetStateAction<boolean>>;
  selectedCsvColIndex: number | null;
  setSelectedCsvColIndex: React.Dispatch<React.SetStateAction<number | null>>;
  selectedCsvColName: string | null;
  setSelectedCsvColName: React.Dispatch<React.SetStateAction<string | null>>;
}

const CSVsettingsCard = ({ file, parsedCSV, csvHasHeaders, setCsvHasHeaders, selectedCsvColIndex, setSelectedCsvColIndex, selectedCsvColName, setSelectedCsvColName }: CSVsettingsCardProps) => {
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);

  const { data, setData } = useContext(WorkflowContext)!;

  // Update headers and the hasHeaders prop of the global "data" state, when hasHeaders is set to true
  useEffect(() => {
    if (csvHasHeaders) {
      const headers = parsedCSV[0];
      setCsvHeaders(headers);
      // If a column was previously selected, update selectedCsvColumn accordingly
      if (selectedCsvColIndex !== null && selectedCsvColIndex < headers.length) {
        setSelectedCsvColName(headers[selectedCsvColIndex]);
      } else {
        setSelectedCsvColName(headers[0]);
        setSelectedCsvColIndex(0);
      }
    } else {
      // No headers, create generic column names
      const numCols = parsedCSV[0].length;
      const genericHeaders = Array.from({ length: numCols }, (_, i) => `Column ${i + 1}`);
      setCsvHeaders(genericHeaders);
      // If a column was previously selected, update selectedCsvColumn accordingly
      if (selectedCsvColIndex !== null && selectedCsvColIndex < numCols) {
        setSelectedCsvColName(`Column ${selectedCsvColIndex + 1}`);
      } else {
        setSelectedCsvColName("Column 1");
        setSelectedCsvColIndex(0);
      }
    }
  }, [csvHasHeaders]);

  return (
    <div className="flex flex-col items-center gap-5 border border-outline pt-4.5 pb-5.5 px-6 rounded-lg">
      <div className="flex flex-col w-full items-start">
        <p>Uploaded file: </p><i>{file.name}</i>
      </div>
      <p>Please specify the following details before proceeding to the next step:</p>
      <form className="flex flex-col w-full gap-4">
        <div className="flex gap-6 justify-between items-center">
          <label>Does the first row of your CSV file contain headers?</label>
          <div className="flex gap-2">
            <label>Yes</label>
            <input className="mr-1" type="radio" name="headerQuery" value="yes" checked={csvHasHeaders} onChange={() => setCsvHasHeaders(true)} />
            <label>No</label>
            <input type="radio" name="headerQuery" value="no" checked={!csvHasHeaders} onChange={() => setCsvHasHeaders(false)} />
          </div>
        </div>
        <div className="flex justify-between items-center gap-6">
          <label>Select the CSV column to code:</label>
          <select 
            className="border border-outline bg-background rounded p-1"
            value={selectedCsvColName ?? "No selection"}
            onChange={(e) => {
              setSelectedCsvColName(e.target.value);
              e.target.selectedIndex !== -1 && setSelectedCsvColIndex(e.target.selectedIndex);
            }}
          >
            {csvHasHeaders ? csvHeaders.map((colName) => {
              return <option key={colName} value={colName}>{colName.length > 30 ? colName.slice(0, 40).trim() + "..." : colName}</option>
            })
            : Array.from({ length: csvHeaders.length }, (_, i) => i).map((colIndex) => (
              <option key={colIndex} value={`Column ${colIndex + 1}`}>Column {colIndex + 1}</option>
            ))
            }
          </select>
        </div>
      </form>
    </div>
  );
}

export default CSVsettingsCard;
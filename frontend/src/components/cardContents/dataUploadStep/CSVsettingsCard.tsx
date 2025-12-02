import { useState, useEffect, useRef } from "react";

interface CSVsettingsCardProps {
  parsedCSV: string[][];
  csvHeaders: string[] | null;
  setCsvHeaders: React.Dispatch<React.SetStateAction<string[] | null>>;
}

const CSVsettingsCard = ({ parsedCSV, csvHeaders, setCsvHeaders }: CSVsettingsCardProps) => {
  const [hasHeaders, setHasHeaders] = useState<boolean | null>(null);

  const yesRadioRef = useRef<HTMLInputElement>(null);
  const noRadioRef = useRef<HTMLInputElement>(null);

  // Ensure that on remount, the radio buttons reflect the current state
  useEffect(() => {
    if (csvHeaders && csvHeaders.length > 0) {
      setHasHeaders(true);
    } else if (csvHeaders && csvHeaders.length === 0) {
      setHasHeaders(false);
    } else {
      setHasHeaders(null);
    }
  }, []);

  // Update the headers into the global state, when hasHeaders is set to true
  useEffect(() => {
    // Only set headers if user has made a selection
    if (yesRadioRef.current?.checked || noRadioRef.current?.checked) {
      if (hasHeaders) {
        const headers = parsedCSV[0];
        setCsvHeaders(headers);
      } else {
        setCsvHeaders([]);
      }
    }
  }, [hasHeaders]);

  return (
      <form className="flex flex-col w-full gap-4">
        <div className="flex gap-6 justify-between items-center">
          <label>Does the first row of your CSV file contain headers?</label>
          <div className="flex gap-2">
            <label>Yes</label>
            <input ref={yesRadioRef} className="mr-1" type="radio" name="headerQuery" value="yes" checked={hasHeaders ?? false} onChange={() => setHasHeaders(true)} />
            <label>No</label>
            <input ref={noRadioRef} type="radio" name="headerQuery" value="no" checked={hasHeaders === false} onChange={() => setHasHeaders(false)} />
          </div>
        </div>
      </form>
  );
}

export default CSVsettingsCard;
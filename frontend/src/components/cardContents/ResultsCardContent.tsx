import { useEffect, useContext, useState } from "react";
import { WorkflowContext } from "../../context/WorkflowContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, LabelList } from 'recharts';
import Button from "../Button";
import { ArrowDownTrayIcon } from "@heroicons/react/24/solid";
import { getPassageWithSurroundingContext } from "./codingStep/utils/passageUtils";

const ResultsCardContent = () => {
  const context = useContext(WorkflowContext)!;
  const { codes, passages, passagesPerColumn, codebook, uploadedFile } = context;
  const [data, setData] = useState<{ code: string; count: number }[]>([]);

  useEffect(() => {
    // Count code occurrences
    const codeCounts = Array.from(codebook)
      .map((code) => ({
        code: code,
        count: codes.filter((c) => c.code === code).length,
      }))
      .sort((a, b) => b.count - a.count);
    
    // Update the state with the sorted data
    setData(codeCounts);
  }, []);

  const truncateLabel = (label: string) => {
    const maxLength = 30;
    return label.length > maxLength ? label.substring(0, maxLength) + '...' : label;
  };

  const handleFileDownload = () => {
    const setsOfPassages =
      passagesPerColumn ?? new Map<number, typeof passages>([[0, passages]]); // For text files, there is only one set

    // For each set of passages in the map, create and download a CSV
    setsOfPassages.forEach((columnPassages, columnIndex) => {
      // Prepare CSV content for this column
      let csvContent = "data:text/csv;charset=utf-8,Context,Passage,Codes\n";

      // If there are no coded passages, skip this column (i.e. no download triggered)
      if (!columnPassages.some((p) => p.codeIds.length > 0)) return;

      columnPassages.forEach((p) => {
        if (p.codeIds.length === 0) return; // Skip passages with no codes

        const passageCodes = p.codeIds
          .map((id: string | number) => codes.find((c) => c.id === id)?.code)
          .filter(Boolean) as string[];

        const uniqueCodes = Array.from(new Set(passageCodes));
        const codesString = uniqueCodes.join("; ");

        // Use this column's passages to compute context
        const contextText = getPassageWithSurroundingContext(
          p,
          columnPassages,
          200,
          200,
          false,
          uploadedFile?.type === "text/csv"
        ).replace("\u001E", ""); // Remove the record separator characters that were used as row ending tokens

        const passageText = p.text.replace("\u001E", ""); // Also clean passage text

        // Escape double quotes by doubling them, and wrap fields in double quotes
        csvContent += `"${contextText.replace(/"/g, '""')}","${passageText.replace(/"/g, '""')}","${codesString}"\n`;
      });

      // Create a download link and trigger the download
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      const suffix =
        setsOfPassages.size > 1 ? `_column_${columnIndex}` : "";
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `coded_passages${suffix}.csv`);
      document.body.appendChild(link); // Required for Firefox
      link.click();
      document.body.removeChild(link);
    });
  };

  return (
    <div className="flex items-center gap-4">
      <BarChart width={1000} height={400} data={data} margin={{ top: 20, right: 30, left: 100, bottom: 150 }}>
        <XAxis dataKey="code" angle={-40} textAnchor="end" tickFormatter={truncateLabel} />
        <YAxis />
        <Tooltip />
        <Bar dataKey="count" fill="#4F6074">
          <LabelList dataKey="count" position="top" />
        </Bar>
      </BarChart>
      <div className="flex flex-col gap-2 items-center max-w-[400px]">
        <p>Download coded passages as a csv file:</p>
        <Button onClick={handleFileDownload} label={"Download CSV"} icon={ArrowDownTrayIcon} variant="primary" title={"Download coded passages as a CSV file"}></Button>
        <p className="pt-4">NOTE: If you uploaded a CSV file, the download will include separate files for each column that you added some codes to.</p>
      </div>
     
    </div>
  );
};

export default ResultsCardContent;
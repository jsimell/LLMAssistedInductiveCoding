import { useEffect, useContext, useState } from "react";
import { WorkflowContext } from "../../context/WorkflowContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, LabelList } from 'recharts';
import Button from "../Button";
import { ArrowDownTrayIcon } from "@heroicons/react/24/solid";

const ResultsCardContent = () => {
  const context = useContext(WorkflowContext)!;
  const { codes, passages, codebook, setProceedAvailable } = context;
  const [data, setData] = useState<{ code: string; count: number }[]>([]);

  // Moving to the next step should be allowed by default in this step
  useEffect(() => {
    setProceedAvailable(true);
  }, []);

  useEffect(() => {
    // Count code occurrences
    const codeCounts = Array.from(codebook)
      .map((code) => ({
        code: code,
        count: codes.filter((c) => c.code === code).length,
      }))
      .sort((a, b) => b.count - a.count);
    
    // Update the state with the sorted data
    console.log("Code counts:", codeCounts);
    setData(codeCounts);
  }, []);

  const truncateLabel = (label: string) => {
    const maxLength = 30;
    return label.length > maxLength ? label.substring(0, maxLength) + '...' : label;
  };

  const handleFileDownload = () => {
    // Prepare CSV content
    let csvContent = "data:text/csv;charset=utf-8,Passage,Codes\n";
    passages.forEach(p => {
      if (p.codeIds.length === 0) return; // Skip passages with no codes
      const passageCodes = p.codeIds
        .map(id => codes.find(c => c.id === id)?.code)
        .filter(Boolean) as string[];
      const uniqueCodes = Array.from(new Set(passageCodes));
      const codesString = uniqueCodes.join("; ");
      csvContent += `"${p.text.replace(/"/g, '""')}","${codesString}"\n`;
    });

    // Create a download link and trigger the download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "coded_passages.csv");
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex items-center gap-4">
      <BarChart width={1000} height={400} data={data} margin={{ top: 20, right: 30, left: 100, bottom: 170 }}>
        <XAxis dataKey="code" angle={-40} textAnchor="end" tickFormatter={truncateLabel} />
        <YAxis />
        <Tooltip />
        <Bar dataKey="count" fill="#4F6074">
          <LabelList dataKey="count" position="top" />
        </Bar>
      </BarChart>
      <div className="flex flex-col gap-2 items-center">
        <p>Download coded passages as a csv file:</p>
        <Button onClick={handleFileDownload} label={"Download CSV"} icon={ArrowDownTrayIcon} variant="primary" title={"Download coded passages as a CSV file"}></Button>
      </div>
     
    </div>
  );
};

export default ResultsCardContent;
import { useContext, useMemo } from "react";
import { WorkflowContext } from "../../../context/WorkflowContext";
import CodeBookRow from "./CodeBookRow";

interface CodebookProps {
  codeManager: {
    editAllInstancesOfCode: (oldValue: string, newValue: string) => void;
  };
}

const Codebook = ({ codeManager }: CodebookProps) => {
  const { codebook, codes } = useContext(WorkflowContext)!;

  const getCodeCount = (code: string) => {
    return codes.filter((c) => c.code === code).length;
  };

  const codebookArray = useMemo(() => {
    return Array.from(codebook)
      .filter((code) => code ? code.trim().length > 0 : false)
      .sort((a, b) => getCodeCount(b) - getCodeCount(a));
  }, [codebook, codes]); // Only re-sort when codebook or codes change

  return (
    <div className="flex flex-col items-center w-full h-fit rounded-xl border-1 border-outline">
      <div className="flex h-fit w-full items-center justify-center px-4.5 pt-4 pb-3.5 border-b border-outline rounded-t-xl bg-container text-primary">
        <p className="text-lg font-semibold">Codebook</p>
      </div>
      <div className="flex flex-col w-full px-6 py-4 items-center">
        {codebookArray.length === 0 && <p>No codes yet</p>}
        {codebookArray.map((code) => (
          <CodeBookRow key={code} code={code} codeManager={codeManager} />
        ))}
      </div>
    </div>
  );
};

export default Codebook;
import { useContext, useMemo } from "react";
import { WorkflowContext } from "../../../context/WorkflowContext";
import CodeBookRow from "./CodeBookRow";

const Codebook = () => {
  const { codebook } = useContext(WorkflowContext)!;

  const codebookArray = useMemo(() => {
    return Array.from(codebook)
      .sort((a, b) => a.localeCompare(b))
      .filter((code) => code ? code.trim().length > 0 : false);
  }, [codebook]); // Only re-sort when codebook changes

  return (
    <div className="flex flex-col items-center w-full h-fit rounded-xl border-1 border-outline">
      <div className="flex h-fit w-full items-center justify-center px-4.5 pt-4 pb-3.5 border-b border-outline rounded-t-xl bg-container text-primary">
        <p className="text-lg font-semibold">Codebook</p>
      </div>
      <div className="flex flex-col w-full px-6 py-4 items-center">
        {codebookArray.length === 0 && <p>No codes yet</p>}
        {codebookArray.map((code) => (
          <CodeBookRow key={code} code={code} />
        ))}
      </div>
    </div>
  );
};

export default Codebook;
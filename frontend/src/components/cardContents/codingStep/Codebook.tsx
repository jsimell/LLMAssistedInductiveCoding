import { useContext } from "react";
import { WorkflowContext } from "../../../context/WorkflowContext";
import CodeBookRow from "./CodeBookRow";

const Codebook = () => {
  const { codebook } =  useContext(WorkflowContext)!;  // Non-null assertion since parent already ensures WorkflowContext is provided
  const codebookArray = Array.from(codebook);

  return (
    <div className="flex flex-col items-center w-full h-fit min-w-50 max-w-sm rounded-xl border-1 border-outline">
      <div className="flex h-fit w-full items-center justify-center px-4.5 pt-4 pb-3.5 border-b border-outline rounded-t-xl bg-container text-primary">
        <p className="text-lg font-semibold">Codebook</p>
      </div>
      <div className="flex flex-col w-full px-6 py-4 items-center">
        {codebookArray.filter((code) => code.trim().length > 0).length ===
          0 && <p>No codes yet</p>}
        {codebookArray.map((code) => (
          <CodeBookRow
            key={code}
            code={code}
          />
        ))}
      </div>
    </div>
  );
};

export default Codebook;

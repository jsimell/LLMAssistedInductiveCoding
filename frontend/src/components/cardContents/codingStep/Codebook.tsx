import { useContext } from "react";
import { WorkflowContext } from "../../../context/WorkflowContext";
import { PencilSquareIcon } from "@heroicons/react/24/solid";

const Codebook = () => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("WorkflowContext must be used within a WorkflowProvider");
  }
  const { codebook, codes } = context;
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
          <div
            key={code}
            className="flex justify-between items-center gap-10 w-full"
          >
            {code.trim().length > 0 && (
              <>
                <span className="flex items-center gap-1.5 py-1">
                  {code.trim()}
                  <PencilSquareIcon className="w-6 h-6 p-0.5 flex-shrink-0 rounded-sm text-[#007a60] hover:bg-tertiary/10 cursor-pointer" />
                </span>
                <span>{`(${
                  codes.filter((c) => c.code.trim() === code.trim()).length
                })`}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Codebook;

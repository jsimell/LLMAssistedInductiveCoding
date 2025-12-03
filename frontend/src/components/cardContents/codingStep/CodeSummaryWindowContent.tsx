import { XMarkIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { WorkflowContext } from "../../../context/WorkflowContext";
import { getPassageWithSurroundingContext } from "./utils/passageUtils";

interface CodeSummaryWindowContentProps {
  showCodeSummaryFor: string | null;
  setShowCodeSummaryFor: (code: string | null) => void;
  dataIsCSV: boolean;
}

const CodeSummaryWindowContent = ({ showCodeSummaryFor, setShowCodeSummaryFor, dataIsCSV }: CodeSummaryWindowContentProps) => {
  const { codes, passages } = useContext(WorkflowContext)!;

  return (
    <div className="flex flex-col overflow-y-auto max-h-[55vh] px-4">
      <div className="flex flex-col sticky top-0">
        <div className="flex justify-between items-center bg-background pt-2 pb-6 z-10">
          <p className="text-lg font-semibold">Showing all occurrences of code: 
            <span className="font-normal bg-tertiaryContainer rounded-full self-center pl-2 pr-1.5 ml-1.5 my-0.5">{showCodeSummaryFor}</span>
          </p>
          <XMarkIcon 
            title="Close window" 
            className="w-8 h-8 p-0.5 flex-shrink-0 rounded-full text-black hover:bg-gray-700/10 cursor-pointer stroke-2"
            onClick={() => setShowCodeSummaryFor(null)}
          />
        </div>
      </div>
      <div>
        <span className="block mb-5 w-full border-t border-outline"></span>
        {codes.filter(c => c.code === showCodeSummaryFor).map((c) => {
          const passage = passages.find(p => p.id === c.passageId);
          if (!passage) return null;
          const context = getPassageWithSurroundingContext(passage, passages, 50, 50, false, dataIsCSV);
          const passageStartIdx = context.indexOf(passage.text);
          return (
            <>
              <div key={passage.id} className="mb-4">
                <span>{context.slice(0, passageStartIdx)}</span>
                <span className="bg-tertiaryContainer rounded-sm w-fit mr-1">{context.slice(passageStartIdx, passageStartIdx + passage.text.length)}</span>
                <span>{context.slice(passageStartIdx + passage.text.length)}</span>
              </div>
              <span className="block my-5 w-full border-t border-outline"></span>
            </>
          );
        })}
      </div>
    </div>
  );
};

export default CodeSummaryWindowContent;
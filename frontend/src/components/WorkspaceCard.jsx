import { useContext } from "react";
import StepNavigationButtons from "./StepNavigationButtons";
import WorkspaceCardHeader from "./WorkspaceCardHeader";
import { WorkflowContext } from "../context/WorkflowContext";

const WorkspaceCard = ({ title, children }) => {
  const { currentStep } = useContext(WorkflowContext);

  return (
    <div className="flex flex-col h-full w-full border-1 rounded-3xl border-onBackground shadow-sm">
      <WorkspaceCardHeader title={title}></WorkspaceCardHeader>
      <div className="flex flex-col flex-1 px-12 py-12 items-center bg-background text-onBackground text-base rounded-b-3xl">
        {children}
      </div>
      <div className="flex-1 flex items-end pb-7 px-7 gap-7">
        <StepNavigationButtons hidePrev={currentStep === 1} hideNext={currentStep === 5}/>
      </div>
    </div>
  );
}

export default WorkspaceCard;
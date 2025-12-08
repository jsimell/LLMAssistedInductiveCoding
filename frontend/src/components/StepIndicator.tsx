import { useContext } from "react";
import { WorkflowContext } from "../context/WorkflowContext";

interface StepIndicatorProps {
  label: string;
  idx: number;
  showLabels: boolean;
}

const StepIndicator = ({ label, idx, showLabels }: StepIndicatorProps) => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("StepIndicator must be used within a WorkflowProvider");
  }
  const { currentStep, setCurrentStep, visitedSteps } = context;
  const isVisited = visitedSteps.has(idx);

  const handleClick = () => {
    if (isVisited) setCurrentStep(idx);
  };

  const circleClasses =
    idx <= currentStep
      ? 'w-6 h-6 rounded-full bg-primary'
      : isVisited 
        ? 'w-6 h-6 rounded-full bg-container border-2 border-primary'
        : 'w-6 h-6 rounded-full bg-container border-2 border-gray-400';

  return (
    <div 
      className={`flex gap-4 h-fit w-full rounded-xl items-center py-1
        ${isVisited ? "cursor-pointer hover:bg-primary/10 hover:text-primary" : "cursor-default"}
        ${!showLabels ? "rounded-full justify-center" : ""}
      `}
      onClick={handleClick}
      title={isVisited ? `Return to the '${label}' step` : undefined}
    >
      <div className={circleClasses}></div>
      {showLabels && <p className={`text-base text-nowrap ${idx === currentStep ? "font-bold text-primary" : ""} ${!isVisited ? "text-gray-500" : ""}`}>{label}</p>}
    </div>
  );
};

export default StepIndicator;

import { useContext } from "react";
import { WorkflowContext } from "../context/WorkflowContext";

const StepIndicator = ({ label, idx }) => {
  const { currentStep, setCurrentStep, visitedSteps } = useContext(WorkflowContext);
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
      className={`flex gap-4 h-fit w-fit rounded-xl pr-2 items-center
        ${isVisited ? "cursor-pointer hover:bg-primary/10 hover:text-primary" : "cursor-default"}
      `}
      onClick={handleClick}
      title={isVisited ? `Return to the '${label}' step` : undefined}
    >
      <div className={circleClasses}></div>
      <p className={`text-base text-nowrap ${idx === currentStep ? "font-bold text-primary" : ""} ${!isVisited ? "text-gray-500" : ""}`}>{label}</p>
    </div>
  );
};

export default StepIndicator;

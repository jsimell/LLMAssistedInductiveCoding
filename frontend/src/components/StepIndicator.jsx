import { useContext } from "react";
import { WorkflowContext } from "../context/WorkflowContext";

const StepIndicator = ({ label, idx }) => {
  const { currentStep, setCurrentStep } = useContext(WorkflowContext);
  const isClickable = idx < currentStep;

  const handleClick = () => {
    if (isClickable) setCurrentStep(idx);
  };

  const circleClasses =
    idx <= currentStep
      ? 'w-6 h-6 rounded-full bg-primary'
      : 'w-6 h-6 rounded-full bg-container border-2 border-primary';

  return (
    <div 
      className={`flex gap-4 h-fit w-fit rounded-xl pr-2 items-center
        ${isClickable ? "cursor-pointer hover:bg-primary/10 hover:text-primary" : ""}
      `}
      onClick={handleClick}
      title={isClickable ? `Return to the '${label}' step` : undefined}
    >
      <div className={circleClasses}></div>
      <p className="text-base text-nowrap">{label}</p>
    </div>
  );
};

export default StepIndicator;

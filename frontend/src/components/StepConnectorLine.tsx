interface StepConnectorLineProps {
  idx: number;
  currentStepIdx: number;
}

const StepConnectorLine = ({ idx, currentStepIdx }: StepConnectorLineProps) => {
  const widthClass = idx < currentStepIdx ? 'w-1' : 'w-0.5';

  return (
    <div className={`w-fit h-fit`}>
      <div className={`bg-onBackground h-6 ${widthClass}`}></div>
    </div>
  );
};

export default StepConnectorLine;
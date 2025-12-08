import { useContext } from 'react';
import { WorkflowContext } from '../context/WorkflowContext';
import Button from './Button';
import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

interface StepNavigationButtonsProps {
  hidePrev?: boolean;
  hideNext?: boolean;
}

const StepNavigationButtons = ({ hidePrev=false, hideNext=false }: StepNavigationButtonsProps) => {
  const context = useContext(WorkflowContext);
  if (!context) return null;
  const { currentStep, setCurrentStep, proceedAvailable, setProceedAvailable } = context;

  const handleNextButtonClick = () => {
    setCurrentStep(currentStep + 1);
    setProceedAvailable(false);
  }

  const handlePrevButtonClick = () => {
    setCurrentStep(currentStep - 1);
    setProceedAvailable(true);
  }

  return (
    <>
      {!hidePrev && 
        <div className="flex flex-1 justify-start">
          <Button 
            label="Previous step"
            icon={ArrowLeftIcon} 
            iconPosition="start" 
            onClick={handlePrevButtonClick} 
            variant="primary"
            title="Return to the previous step"
          ></Button>
        </div>
      }
      {!hideNext && 
        <div className="flex flex-1 justify-end">
          <Button
            label="Next step" 
            icon={ArrowRightIcon} 
            onClick={handleNextButtonClick} 
            variant={proceedAvailable ? "primary" : "disabled"}
            title={proceedAvailable ? "Proceed to the next step" : "Please complete the required actions to continue"}
          ></Button>
        </div>
      }
    </>
  )
}

export default StepNavigationButtons;

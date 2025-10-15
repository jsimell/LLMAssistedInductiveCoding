import { useContext } from 'react';
import { WorkflowContext } from '../context/WorkflowContext';
import Button from './Button';
import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

const StepNavigationButtons = ({ hidePrev=false, hideNext=false }) => {
  const { currentStep, setCurrentStep, proceedAvailable, setProceedAvailable } = useContext(WorkflowContext);

  const handleNextButtonClick = () => {
    setCurrentStep(currentStep + 1);
    setProceedAvailable(false);
  }

  const handlePrevButtonClick = () => {
    setCurrentStep(currentStep - 1);
    setProceedAvailable(true);
  }

  return (
    <div className="flex w-full">
      {!hidePrev && 
        <div className="flex flex-1 justify-start">
          <Button 
            label="Previous step"
            icon={ArrowLeftIcon} 
            iconPosition="start" 
            onClick={handlePrevButtonClick} 
            variant="primary"
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
          ></Button>
        </div>
      }
    </div>
  )
}

export default StepNavigationButtons;

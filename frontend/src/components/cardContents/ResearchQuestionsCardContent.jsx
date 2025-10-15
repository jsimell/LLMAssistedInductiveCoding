import { useState, useContext, useRef, useEffect } from "react";
import { WorkflowContext } from "../../context/WorkflowContext";
import StepNavigationButtons from "../StepNavigationButtons";
import Button from "../Button";

const ResearchQuestionsCardContent = () => {
  const { currentStep, researchQuestions, setResearchQuestions, contextInfo, setContextInfo, setProceedAvailable } = useContext(WorkflowContext);
  const [currentRQs, setCurrentRQs] = useState("");
  const [currentContextInfo, setCurrentContextInfo] = useState("");
  const formRef = useRef(null);

  // Make sure the next step button is available if the user returns to this screen after submitting the info previously
  useEffect(() => {
    (contextInfo && researchQuestions && currentStep === 3)  ? setProceedAvailable(true) : null;
  }, [currentStep]);

  const handleSubmit = () => {
    setResearchQuestions(currentRQs);
    setContextInfo(currentContextInfo);
    setProceedAvailable(true);
  }

  return (
    <div className="flex flex-col w-full h-full gap-4 pt-12 pb-6 px-6.5">
      <div className="flex flex-col px-15 pb-10">
        <div className="flex flex-col pb-3">
          <ul className="list-disc ml-4">
            <li>
              Enter your <b>research questions</b> for inductive coding below. You can include multiple questions in the same field.
            </li>
            <li>
              Optionally, you can also provide additional <b>contextual information</b> (e.g. data origin, type of data, coding contraints or instructions) to help the AI give more precise suggestions. This could include:
            </li>
          </ul>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-2 pb-2 w-full">
          <div>
            <label htmlFor="RQs" className="text-nowrap">Research question(s):</label>
            <input 
              id="RQs"
              value={currentRQs} 
              onChange={(e) => setCurrentRQs(e.target.value)} 
              type="text" 
              className="border-1 w-full h-fit" 
            />
          </div>
          <div className="flex flex-col">
            <label for="contextInfo">Contextual information:</label>
            <textarea
              id="contextInfo"
              value={currentContextInfo} 
              onChange={(e) => setCurrentContextInfo(e.target.value)} 
              type="text" 
              className="border-1" 
            />
          </div>
        </form>
        <div className="flex w-full justify-center">
          <Button label="Submit" onClick={handleSubmit} variant={"tertiary"}></Button>
        </div>
      </div>
      <StepNavigationButtons></StepNavigationButtons>
    </div>
  );
}

export default ResearchQuestionsCardContent;
import { useState, useContext, useRef, useEffect } from "react";
import { WorkflowContext } from "../../context/WorkflowContext";
import Button from "../Button";

const ResearchQuestionsCardContent = () => {
  const {
    currentStep,
    researchQuestions,
    setResearchQuestions,
    contextInfo,
    setContextInfo,
    setProceedAvailable,
  } = useContext(WorkflowContext);
  const [currentRQs, setCurrentRQs] = useState("How do the interviewees perceive the user experience of the system? How does it compare to their previous experiences with qualitative coding?");
  const [currentContextInfo, setCurrentContextInfo] = useState("The data is from a group user interview with three interviewees and one interviewer, conducted after testing of an AI assisted inductive coding system.");
  const formRef = useRef(null);

  // Make sure the next step button is available if the user returns to this screen after submitting the info previously
  useEffect(() => {
    contextInfo && researchQuestions && currentStep === 3
      ? setProceedAvailable(true)
      : null;
  }, [currentStep]);

  // Populate the input fields with previously submitted info when the component loads
  useEffect(() => {
    if (researchQuestions) setCurrentRQs(researchQuestions);
    if (contextInfo) setCurrentContextInfo(contextInfo);
  }, [researchQuestions, contextInfo]);

  const handleSubmit = () => {
    if (!currentRQs.trim()) {
      alert("Please enter at least one research question!");
      return;
    }
    setResearchQuestions(currentRQs);
    setContextInfo(currentContextInfo);
    setProceedAvailable(true);
  };

  const informationHasChanged = () => {
    return (
      currentRQs !== researchQuestions || currentContextInfo !== contextInfo
    );
  };

  return (
    <div className="flex flex-col w-full px-5 items-center">
      <ul className="list-disc ml-4 pb-3">
        <li>
          Enter your <b>research questions</b> for inductive coding below. You
          can include multiple questions in the same field.
        </li>
        <li>
          Optionally, you can also provide additional{" "}
          <b>contextual information</b> (e.g. data origin, type of data, coding
          contraints or instructions etc.) to help the AI give more precise
          suggestions. This could include:
        </li>
      </ul>
      <form
        ref={formRef}
        onSubmit={informationHasChanged() ? handleSubmit : undefined}
        className="flex flex-col gap-2 pb-2 w-full"
      >
        <div>
          <label htmlFor="RQs" className="text-nowrap">
            Research question(s):
          </label>
          <input
            id="RQs"
            value={currentRQs}
            onChange={(e) => setCurrentRQs(e.target.value)}
            type="text"
            className="border-1 w-full h-fit"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="contextInfo">Contextual information:</label>
          <textarea
            id="contextInfo"
            value={currentContextInfo}
            onChange={(e) => setCurrentContextInfo(e.target.value)}
            type="text"
            className="border-1"
          />
        </div>
      </form>
      <Button
        label="Submit"
        onClick={informationHasChanged() ? handleSubmit : undefined}
        variant={informationHasChanged() ? "tertiary" : "disabled"}
        title={informationHasChanged() ? "Submit the current input" : ((!currentContextInfo && !currentRQs) ? "Please type something to enable submission" : "Please modify the information to enable submission")}
      ></Button>
      {researchQuestions && (
        <div className="pt-3 pb-4 w-full">
          <p className="pb-3">
            Resubmit the form to change the currently submitted information:
          </p>
          <p>
            <b>Research questions:</b> {researchQuestions}
          </p>
          <p>
            <b>Contextual information:</b> {contextInfo ? contextInfo : "-"}
          </p>
        </div>
      )}
    </div>
  );
};

export default ResearchQuestionsCardContent;

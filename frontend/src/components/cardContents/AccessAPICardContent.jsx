import { useState, useRef, useContext, useEffect } from "react";
import { WorkflowContext } from "../../context/WorkflowContext";
import { ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import Button from "../Button";
import InfoBox from "../InfoBox";
import { validateApiKey } from "../../services/validateApiKey";

const AccessAPICardContent = () => {
  const [currentInput, setCurrentInput] = useState("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");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const { apiKey, setApiKey, setProceedAvailable, currentStep } = useContext(WorkflowContext);
  const formRef = useRef(null);

  // Make sure the next step button is available if the user returns to this screen after validating a key previously
  useEffect(() => {
    (apiKey && currentStep === 2)  ? setProceedAvailable(true) : null;
  }, [currentStep]);

  const handleSubmit = async (e) => {
    e?.preventDefault(); // Safe guard
    setIsValidating(true);
    setIsSubmitted(true);
    setIsValid(false);
    setApiKey(null); // Make sure a possible prior key is deleted first

    const validationResult = await validateApiKey(currentInput);

    if (validationResult.valid) {
      setIsValid(true);
      setProceedAvailable(true);
      setApiKey(currentInput);
      setCurrentInput("");
    } else {
      setErrorMsg(validationResult.error);
    }

    setIsValidating(false);
  };

  const handleKeyDeletion = () => {
    setApiKey(null);
    setIsSubmitted(false);
    setIsValid(false);
  }

  return (
    <>
      <div className="flex items-center justify-center w-full pb-6">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-1 max-w-[400px] gap-1.5 items-center justify-center">
          <label htmlFor="apiKey" className="text-nowrap">OpenAI API key:</label>
          <input 
            id="apiKey" 
            type="text" 
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            spellCheck="false" 
            className="border-1 h-fit flex-1 border-outline rounded-sm p-1 mr-4" 
          />
        <Button label="Submit" onClick={handleSubmit} variant={isValidating ? "disabled" : "tertiary"}></Button>
        </form>
      </div>
      <div className="flex flex-col gap-3">
        {apiKey && (
          <div className="flex justify-center items-center gap-2">
            <div>Validated key:</div>
            <div className="flex gap-1 items-center">
              <i>{`${apiKey.slice(0, 11)}•••••${apiKey.slice(-3)}`}</i>
              <XCircleIcon onClick={handleKeyDeletion} className="size-5 bg-red-600 hover:bg-red-800 rounded-full cursor-pointer"></XCircleIcon>
            </div>
          </div>
        )}
        {isSubmitted && isValidating && (
          <InfoBox msg="Validating API key..." variant="loading"></InfoBox>
        )}
        {isSubmitted && !isValidating && !isValid && (
          <InfoBox msg={errorMsg} icon={ExclamationTriangleIcon} variant="error"></InfoBox>
        )}
        {((isSubmitted && !isValidating && isValid) || apiKey) && (
          <InfoBox msg="API key is valid: You may proceed to the next step" icon={CheckCircleIcon} variant="success"></InfoBox>
        )}
      </div>
    </>
  );
}

export default AccessAPICardContent;
import { useState, useContext, useEffect } from "react";
import { WorkflowContext } from "../../context/WorkflowContext";
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import Button from "../Button";
import InfoBox from "../InfoBox";
import { validateApiKey } from "../../services/validateApiKey";

const AccessAPICardContent = () => {
  const [currentInput, setCurrentInput] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("AccessAPICardContent must be used within a WorkflowContextProvider");
  }
  const { apiKey, setApiKey, setProceedAvailable, currentStep } = context;

  // Make sure the next step button is available if the user returns to this screen after validating a key previously
  useEffect(() => {
    apiKey && currentStep === 2 ? setProceedAvailable(true) : null;
  }, [currentStep]);

  const handleSubmit = async () => {
    if (isValidating) return; // avoid double-submit clicks

    setIsValidating(true);
    setIsSubmitted(true);
    setIsValid(false);
    setApiKey(""); // Make sure a possible prior key is deleted first

    const validationResult = await validateApiKey(currentInput);

    if (validationResult && validationResult.valid) {
      setIsValid(true);
      setProceedAvailable(true);
      setApiKey(currentInput);
      setCurrentInput("");
    } else {
      setErrorMsg(validationResult.error || "Unknown error during API key validation.");
    }

    setIsValidating(false);
  };

  const handleKeyDeletion = () => {
    setApiKey("");
    setIsSubmitted(false);
    setIsValid(false);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center justify-center w-full pb-6">
        <div className="flex flex-1 max-w-[400px] gap-1.5 items-center justify-center">
          <label htmlFor="apiKey" className="text-nowrap">
            OpenAI API key:
          </label>
          <input
            id="apiKey"
            type="text"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            spellCheck="false"
            className="border-1 h-fit flex-1 border-outline rounded-sm p-1 mr-4 accent-[#006851]"
          />
          <Button
            label="Submit"
            onClick={handleSubmit}
            variant={isValidating ? "disabled" : "tertiary"}
          ></Button>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {apiKey && (
          <div className="flex justify-center items-center gap-2">
            <div>Validated key:</div>
            <div className="flex gap-1 items-center">
              <i>{`${apiKey.slice(0, 11)}•••••${apiKey.slice(-3)}`}</i>
              <XCircleIcon
                onClick={handleKeyDeletion}
                className="size-5 bg-red-600 hover:bg-red-800 rounded-full cursor-pointer"
              ></XCircleIcon>
            </div>
          </div>
        )}
        {isSubmitted && isValidating && (
          <InfoBox msg="Validating API key..." variant="loading"></InfoBox>
        )}
        {isSubmitted && !isValidating && !isValid && (
          <InfoBox
            msg={errorMsg || "Unknown error during API key validation."}
            icon={ExclamationTriangleIcon}
            variant="error"
          ></InfoBox>
        )}
        {((isSubmitted && !isValidating && isValid) || apiKey) && (
          <InfoBox
            msg="API key is valid: You may proceed to the next step"
            icon={CheckCircleIcon}
            variant="success"
          ></InfoBox>
        )}
      </div>
    </div>
  );
};

export default AccessAPICardContent;

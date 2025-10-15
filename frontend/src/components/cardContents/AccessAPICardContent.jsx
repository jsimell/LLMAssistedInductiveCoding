import { useState, useRef, useContext, useEffect } from "react";
import { WorkflowContext } from "../../context/WorkflowContext";
import { ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import Button from "../Button";
import InfoBox from "../InfoBox";
import StepNavigationButtons from "../StepNavigationButtons";
import LoadingSymbol from "../LoadingSymbol";

const AccessAPICardContent = () => {
  const [currentInput, setCurrentInput] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const { apiKey, setApiKey, proceedAvailable, setProceedAvailable, currentStep, setCurrentStep } = useContext(WorkflowContext);
  const formRef = useRef(null);
  const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL

  // Make sure the next step button is available if the user returns to this screen after validating a key previously
  useEffect(() => {
    (apiKey && currentStep === 2)  ? setProceedAvailable(true) : null;
  }, [currentStep]);

  const validateApiKey = async (apiKey) => {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/validate_api_key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openai_api_key: apiKey }),
      });

      if (!response.ok) {
        switch (response.status) {
          case 401:
            return { ok: false, error: "invalid_key" };
          case 500:
            return { ok: false, error: "internal_server_error" };
          case 502:
            return { ok: false, error: "openai_error" };
          default:
            return { ok: false, error: "unknown_server_error" };
        }
      }

      const data = await response.json();
      return { ok: data.valid, error: data.valid ? null : "invalid_key" };
    } catch (e) {
      console.error("Network or unexpected error:", e);
      return { ok: false, error: "network_error" };
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault(); // Safe guard
    setIsValidating(true);
    setIsSubmitted(true);
    setIsValid(false);
    setApiKey(null); // Make sure a possible prior key is deleted first

    const validationResult = await validateApiKey(currentInput);

    if (validationResult.ok) {
      setIsValid(true);
      setProceedAvailable(true);
      setApiKey(currentInput);
      setCurrentInput("");
    } else {
      switch (validationResult.error) {
        case "invalid_key":
          setErrorMsg("Invalid API key");
          break;
        case "network_error":
          setErrorMsg("Network error: Could not validate key");
          break;
        case "internal_server_error":
          setErrorMsg("Validation failed: Internal server error");
          break;
        case "openai_error":
          setErrorMsg("Validation failed: OpenAI API error");
          break;
        default:
          setErrorMsg("Validation failed: Unknown error");
      }
    }

    setIsValidating(false);
  };

  const handleKeyDeletion = () => {
    setApiKey(null);
    setIsSubmitted(false);
    setIsValid(false);
  }

  return (
    <div className="flex flex-col w-full h-full items-center gap-4 pt-12 pb-6 px-6.5">
      <div className="flex items-center justify-between max-w-xl w-full gap-4">
        <form ref={formRef} onSubmit={handleSubmit} className="flex items-center gap-3 w-full">
          <label htmlFor="apiKey" className="text-nowrap">OpenAI API key:</label>
          <input 
            id="apiKey" 
            type="text" 
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            spellCheck="false" 
            className="border-1 w-full h-fit" 
          />
        </form>
        <Button label="Submit" onClick={handleSubmit} variant={isValidating ? "disabled" : "tertiary"}></Button>
      </div>
      {apiKey && (
        <div className="flex justify-center gap-6 items-center w-full px-7">
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
      {isSubmitted && !isValidating && isValid && (
        <InfoBox msg="API key is valid: You may proceed to the next step" icon={CheckCircleIcon} variant="success"></InfoBox>
      )}
      <StepNavigationButtons></StepNavigationButtons>
    </div>
  );
}

export default AccessAPICardContent;
import React, { useContext } from "react";
import { WorkflowContext } from "../../../context/WorkflowContext";
import ToggleSwitch from "../../ToggleSwitch";
import QuestionMarkCircleIcon from "@heroicons/react/24/solid/QuestionMarkCircleIcon";

interface CodingSettingsCardProps {
  clickedSuggestionsToggleRef: React.RefObject<boolean>;
}

const CodingSettingsCard = ({ clickedSuggestionsToggleRef }: CodingSettingsCardProps) => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("CodingSettingsCard must be used within a WorkflowProvider");
  }

  const {
    aiSuggestionsEnabled,
    setAiSuggestionsEnabled,
    contextWindowSize,
    setContextWindowSize,
    codingGuidelines,
    setCodingGuidelines,
  } = context;

  return (
    <div className="flex flex-col gap-5 items-center justify-center rounded-lg border-1 border-outline p-6 mb-4">
      <div 
        className="flex gap-2 w-full items-center justify-between"
      >
        <p>AI suggestions</p>
        <ToggleSwitch
          booleanState={aiSuggestionsEnabled}
          setBooleanState={setAiSuggestionsEnabled}
          onMouseDown={() => {
            clickedSuggestionsToggleRef.current = true;
          }}
        />
      </div>
      <div className="flex gap-2 items-center justify-between">
        <div className="flex gap-1 items-center">
          <p>Context window for code suggestions (characters):</p>
        </div>
        <input
          type="number"
          value={contextWindowSize ?? ""}
          onChange={(e) =>
            setContextWindowSize(
              e.target.value === "" ? null : Number(e.target.value)
            )
          }
          onBlur={(e) => {
            if (e.target.value === "" || e.target.value === null) {
              setContextWindowSize(0); // Set to minimum value if input is empty
            }
          }}
          onKeyDown={(e) => {
            e.key === "Enter" && (e.target as HTMLInputElement).blur();
          }}
          className="border-1 border-outline rounded-md p-1 max-w-[80px]"
        />
        <div>
          <QuestionMarkCircleIcon
            className="size-4.5 text-tertiary"
            title="The minimum characters that the prompt will include as surrounding context when generating code suggestions for a highlighted passage. After the minimum characters are reached, the window is cut intelligently within 200 characters (e.g., at a line break). A value of 0 means only the highlighted passage is included in the prompt. &#10;&#10;Larger windows may improve suggestion relevance but increase response time and cost. Recommended values are between 200 and 1000."
          />
        </div>
      </div>
      <div className="flex flex-col w-full">
        <label htmlFor="codingGuidelines">Coding guidelines for the LLM:</label>
        <ul className="list-disc ml-3 pb-2 pt-0.5 text-sm">
          <li>The guidelines you type below are automatically included in the LLM prompts.</li>
        </ul>
        <textarea
          id="codingGuidelines"
          value={codingGuidelines}
          onChange={(e) => setCodingGuidelines(e.target.value)}
          className="flex-1 border-1 border-outline rounded-md p-1"
        />
      </div>
    </div>
  );
};

export default CodingSettingsCard;
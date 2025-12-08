import { useContext, useState } from "react";
import { WorkflowContext } from "../../../context/WorkflowContext";
import ToggleSwitch from "../../ToggleSwitch";
import QuestionMarkCircleIcon from "@heroicons/react/24/solid/QuestionMarkCircleIcon";
import HoverMessage from "../../HoverMessage";
import Button from "../../Button";
import SmallButton from "../../SmallButton";
import OverlayWindow from "../../OverlayWindow";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";
import { getPassageWithSurroundingContext } from "./utils/passageUtils";

interface CodingSettingsCardProps {
  clickedSuggestionsToggleRef: React.RefObject<boolean>;
}

const CodingSettingsCard = ({ clickedSuggestionsToggleRef }: CodingSettingsCardProps) => {
  const [showCodeSuggHoverMsg, setShowCodeSuggHoverMsg] = useState(false);
  const [showHighlightSuggHoverMsg, setShowHighlightSuggHoverMsg] = useState(false);
  const [showFewShotHoverMsg, setShowFewShotHoverMsg] = useState(false);
  const [showExamplesSelectionWindow, setShowExamplesSelectionWindow] = useState(false);

  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("CodingSettingsCard must be used within a WorkflowProvider");
  }

  const {
    aiSuggestionsEnabled,
    setAiSuggestionsEnabled,
    codeSuggestionContextWindowSize,
    setCodeSuggestionContextWindowSize,
    highlightSuggestionContextWindowSize,
    setHighlightSuggestionContextWindowSize,
    codingGuidelines,
    setCodingGuidelines,
    fewShotExamplesSelectionMode,
    setFewShotExamplesSelectionMode,
    randomFewShotExamplesCount,
    setRandomFewShotExamplesCount,
    uploadedFile,
    passages,
    codes,
    fewShotExamples,
    setFewShotExamples,
  } = context;

  const dataIsCSV = uploadedFile?.type === "text/csv";

  return (
    <div className="w-full h-fit flex flex-col items-center justify-center rounded-lg border-1 border-outline">
      <div className="flex h-fit w-full items-center justify-center px-4.5 pt-2.5 pb-2 border-b border-outline rounded-t-lg bg-container text-primary">
        <p className="text-lg font-semibold">Coding Settings</p>
      </div>
      <div className="flex flex-col w-full px-6 items-center pt-6 pb-5 gap-5">
        <div className="flex gap-2 w-full items-center justify-between">
          <p>AI suggestions</p>
          <ToggleSwitch
            booleanState={aiSuggestionsEnabled}
            setBooleanState={setAiSuggestionsEnabled}
            onMouseDown={() => {
              clickedSuggestionsToggleRef.current = true;
            }}
            onMouseLeave={() => {
              clickedSuggestionsToggleRef.current = false;
            }}
          />
        </div>
        <div className="flex gap-2 items-center justify-between">
          <div className="flex gap-1 items-center">
            <p>Context window for code suggestions (characters):</p>
          </div>
          <input
            type="number"
            value={codeSuggestionContextWindowSize ?? ""}
            onChange={(e) =>
              setCodeSuggestionContextWindowSize(
                e.target.value === "" ? null : Number(e.target.value)
              )
            }
            onBlur={(e) => {
              if (e.target.value === "" || e.target.value === null) {
                setCodeSuggestionContextWindowSize(0); // Set to minimum value if input is empty
              }
            }}
            onKeyDown={(e) => {
              e.key === "Enter" && (e.target as HTMLInputElement).blur();
            }}
            className="border-1 border-outline rounded-md p-1 max-w-[80px] accent-[#006851]"
          />
          <div className="relative">
            <QuestionMarkCircleIcon
              className="size-4.5 text-tertiary"
              onMouseEnter={() => setShowCodeSuggHoverMsg(true)}
              onMouseLeave={() => setShowCodeSuggHoverMsg(false)}
            />
            {showCodeSuggHoverMsg && (
              <HoverMessage className="w-[400px] absolute right-full top-1/2 -translate-y-[10%] mr-1">
                <div className="flex flex-col gap-4">
                  <p>
                    The minimum characters that the prompt will include as surrounding
                    context when generating code suggestions for a highlighted passage.
                    70% of the window goes before the passage, 30% after.
                  </p>
                  <p>
                    After the minimum characters are reached, the window is cut
                    intelligently within 100 characters (e.g., at a line break, or
                    sentence end). A value of 0 means only the highlighted passage is
                    included in the code suggestions and autocomplete suggestions prompts.
                  </p>
                  <p>
                    Larger windows may improve suggestion relevance but increase response
                    time and cost.
                  </p>
                </div>
              </HoverMessage>
            )}
          </div>
        </div>
        <div className="flex gap-2 items-center justify-between">
          <div className="flex gap-1 items-center">
            <p>Context window for highlight suggestions (characters):</p>
          </div>
          <input
            type="number"
            value={highlightSuggestionContextWindowSize ?? ""}
            onChange={(e) =>
              setHighlightSuggestionContextWindowSize(
                e.target.value === "" ? null : Number(e.target.value)
              )
            }
            onBlur={(e) => {
              if (e.target.value === "" || e.target.value === null) {
                setHighlightSuggestionContextWindowSize(0); // Set to minimum value if input is empty
              }
            }}
            onKeyDown={(e) => {
              e.key === "Enter" && (e.target as HTMLInputElement).blur();
            }}
            className="border-1 border-outline rounded-md p-1 max-w-[80px] accent-[#006851]"
          />
          <div className="relative">
            <QuestionMarkCircleIcon
              className="size-4.5 text-tertiary"
              onMouseEnter={() => setShowHighlightSuggHoverMsg(true)}
              onMouseLeave={() => setShowHighlightSuggHoverMsg(false)}
            />
            {showHighlightSuggHoverMsg && (
              <HoverMessage className="w-[400px] absolute right-full top-1/2 -translate-y-[10%] mr-1">
                <div className="flex flex-col gap-4">
                  <p>
                    The size of the window from which the LLM will suggest the next text
                    passage to highlight. The size of the window should be large enough to
                    always include a passage that needs to be coded.
                  </p>
                  <p>
                    The starting point of the context window is determined based on the
                    latest entered code or a click on an uncoded section in the data.
                  </p>
                  <p>
                    20% of the context window will be included as preceding context for
                    the LLM, and 80% of the context window will serve as the actual search
                    area from which the LLM will search for the next suggestion. The
                    context window is cut intelligently (e.g., at a line break, or
                    sentence end).
                  </p>
                </div>
              </HoverMessage>
            )}
          </div>
        </div>
        <div className="flex flex-col w-full">
          <label htmlFor="codingGuidelines">Coding guidelines for the LLM:</label>
          <ul className="list-disc ml-3 pb-2 pt-0.5 text-sm">
            <li>
              The guidelines you type below are automatically included in the LLM prompts.
            </li>
          </ul>
          <textarea
            id="codingGuidelines"
            value={codingGuidelines}
            onChange={(e) => setCodingGuidelines(e.target.value)}
            className="flex-1 border-1 border-outline rounded-md p-1 accent-[#006851]"
          />
        </div>
        <div className="flex gap-2 items-center justify-between w-full">
          <p>Examples for the AI:</p>
          <form className="flex gap-3">
            <div className="flex flex-col">
              <label htmlFor="random" className="font-medium">
                Random
              </label>
              <input
                id="random"
                type="radio"
                value="random"
                checked={fewShotExamplesSelectionMode === "random"}
                onChange={() => setFewShotExamplesSelectionMode("random")}
                className="accent-[#006851]"
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="manual" className="font-medium">
                Manual
              </label>
              <input
                id="manual"
                type="radio"
                value="manual"
                checked={fewShotExamplesSelectionMode === "manual"}
                onChange={() => setFewShotExamplesSelectionMode("manual")}
                className="accent-[#006851]"
              />
            </div>
          </form>
        </div>
        {fewShotExamplesSelectionMode === "random" && (
          <div className="flex w-full gap-2 items-center justify-between">
            <div className="flex gap-1 items-center">
              <p className="pr-2">Number of few-shot examples:</p>
            </div>
            <input
              type="number"
              value={randomFewShotExamplesCount ?? ""}
              onChange={(e) =>
                setRandomFewShotExamplesCount(
                  e.target.value === "" ? 0 : Number(e.target.value)
                )
              }
              onBlur={(e) => {
                if (e.target.value === "" || e.target.value === null) {
                  setRandomFewShotExamplesCount(0); // Set to minimum value if input is empty
                }
              }}
              onKeyDown={(e) => {
                e.key === "Enter" && (e.target as HTMLInputElement).blur();
              }}
              className="border-1 border-outline rounded-md p-1 max-w-[80px]"
            />

            <div className="relative">
              <QuestionMarkCircleIcon
                className="size-4.5 text-tertiary"
                onMouseEnter={() => setShowFewShotHoverMsg(true)}
                onMouseLeave={() => setShowFewShotHoverMsg(false)}
              />
              {showFewShotHoverMsg && (
                <HoverMessage className="w-[400px] absolute right-full top-1/2 -translate-y-[10%] mr-1">
                  <div className="flex flex-col gap-4">
                    <p>
                      The system will randomly select the specified number of few-shot
                      examples, if there are that many available. If there are fewer
                      available examples than the specified number, all available examples
                      will be used.
                    </p>
                    <p>
                      New random examples will be selected for each suggestion request.
                    </p>
                  </div>
                </HoverMessage>
              )}
            </div>
          </div>
        )}
        {fewShotExamplesSelectionMode === "manual" && (
          <div className="flex flex-col w-full items-center gap-3 pb-2">
            <SmallButton
              label="Select examples"
              onClick={() => setShowExamplesSelectionWindow(true)}
              variant="tertiary"
            />
            <p className={fewShotExamples.length === 0 ? "text-red-600" : ""}>
              {fewShotExamples.length > 0
                ? `Currently ${fewShotExamples.length} examples selected`
                : "No examples selected"}
            </p>
          </div>
        )}
      </div>
      <OverlayWindow
        isVisible={showExamplesSelectionWindow}
        onClose={() => setShowExamplesSelectionWindow(false)}
      >
        <div className="flex justify-between items-center bg-gray-300 w-full h-fit px-6 py-4 rounded-t-lg z-10">
          <p className="text-xl font-semibold">Select examples for the AI</p>
          <XMarkIcon
            title="Close window"
            className="w-8 h-8 p-0.5 flex-shrink-0 rounded-full text-black hover:bg-gray-700/10 cursor-pointer stroke-2"
            onClick={() => setShowExamplesSelectionWindow(false)}
          />
        </div>
        <div className="flex flex-col gap-5 px-12 pt-10 overflow-y-auto max-h-[60vh]">
          {passages
            .filter((p) => p.isHighlighted)
            .map((passage) => {
              const context = getPassageWithSurroundingContext(
                passage,
                passages,
                50,
                20,
                false,
                dataIsCSV
              );
              const passageStartIdx = context.indexOf(passage.text);
              const isInExamples = Boolean(
                fewShotExamples.find((example) => example.passageId === passage.id)
              );
              return (
                <>
                  <div className="flex gap-6 items-center pl-4">
                    <input
                      type="checkbox"
                      className="accent-[#006851]"
                      checked={isInExamples}
                      onChange={() => {
                        setFewShotExamples((prev) => {
                          if (prev.find((example) => example.passageId === passage.id)) {
                            // If already in few-shot examples, remove it
                            return prev.filter(
                              (example) => example.passageId !== passage.id
                            );
                          } else {
                            // Else, add it
                            return [
                              ...prev,
                              {
                                passageId: passage.id,
                                context: getPassageWithSurroundingContext(
                                  passage,
                                  passages,
                                  50,
                                  20,
                                  true,
                                  dataIsCSV
                                ),
                                codedPassage: passage.text,
                                codes: passage.codeIds
                                  .map(
                                    (codeId) =>
                                      codes.find((code) => code.id === codeId)?.code
                                  )
                                  .filter(Boolean) as string[],
                              },
                            ];
                          }
                        });
                      }}
                    />
                    <div
                      key={passage.id}
                      className={`pr-6 ${
                        isInExamples
                          ? "border-l-7 pl-2 rounded-l-sm border-[#006851]"
                          : ""
                      }`}
                    >
                      <span>{context.slice(0, passageStartIdx)}</span>
                      <span className="bg-tertiaryContainer rounded-sm w-fit mr-1">
                        {context.slice(
                          passageStartIdx,
                          passageStartIdx + passage.text.length
                        )}
                      </span>
                      {passage.codeIds.map((codeId) => {
                        const code = codes.find((c) => c.id === codeId);
                        return code ? (
                          <span
                            key={code.id}
                            className="inline-flex items-center self-center w-fit pl-2 pr-1.5 mr-1 my-0.5 bg-tertiaryContainer border-1 border-gray-400 rounded-full"
                          >
                            {code.code}
                          </span>
                        ) : null;
                      })}
                      <span>{context.slice(passageStartIdx + passage.text.length)}</span>
                    </div>
                  </div>
                  <span className="block my-8 w-full border-t border-outline"></span>
                </>
              );
            })}
          {passages.filter((p) => p.isHighlighted).length === 0 && (
            <p className="text-center px-6">
              You must code some passages to be able to select examples.
            </p>
          )}
        </div>
        <div className="flex justify-center py-6 w-full">
          <Button
            label="Confirm"
            onClick={() => setShowExamplesSelectionWindow(false)}
            variant="tertiary"
          />
        </div>
      </OverlayWindow>
    </div>
  );
};

export default CodingSettingsCard;

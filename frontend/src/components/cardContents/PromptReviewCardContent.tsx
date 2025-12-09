import { useContext, useEffect } from "react";
import { PromptType, WorkflowContext } from "../../context/WorkflowContext";
import { usePrompts } from "./codingStep/hooks/apiCommunication/usePrompts";

const PromptReviewCardContent = () => {
  const promptTypes = ["highlight", "code", "autocomplete"];

  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error(
      "PromptReviewCardContent must be used within a WorkflowContextProvider"
    );
  }
  const { reviewedPromptType, setReviewedPromptType, setProceedAvailable } = context;

  const {
    generateHighlightSuggestionsPrompt,
    generateCodeSuggestionsPrompt,
    generateAutocompleteSuggestionsPrompt,
  } = usePrompts();

  const highlightPrompt = generateHighlightSuggestionsPrompt(
    context.uploadedFile?.type === "text/csv"
  );
  const codePrompt = generateCodeSuggestionsPrompt(
    context.uploadedFile?.type === "text/csv"
  );
  const autocompletePrompt = generateAutocompleteSuggestionsPrompt(
    context.uploadedFile?.type === "text/csv"
  );

  // Proceed should always be available at this step
  useEffect(() => {
    setProceedAvailable(true);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5">
        <p className="max-w-[90%]">
          <b>NOTE:</b> This section is for review purposes only to improve transparency.
          Unfortunately the prompts can not be directly edited here. However, in the next
          step, you will be able to add custom coding guidelines that are included in all
          prompts between the TASK and USER'S CODING STYLE sections.
        </p>
        <h2 className="pt-5 font-semibold text-xl">Suggestion Types</h2>
        <p>
          The app uses three kinds of LLM suggestions. Each type has its own prompt and is
          triggered at a different moment in the workflow.
        </p>
        <ol className="flex max-w-[80%] flex-col gap-4 list-decimal list-inside marker:font-bold">
          <li>
            <b>Highlight suggestions:</b> These suggestions propose the next passage to
            highlight, together with an initial coding for the passage. A fetch for
            highlight suggestions is triggered when you finish editing the codes of the
            previous passage, or when you click on an uncoded section in the data, in
            which case the LLM searches for the first relevant passage starting from the
            beginning of that uncoded section.
          </li>
          <li>
            <b>Code suggestions:</b> These suggestions appear in the UI when a code is
            being typed for a passage, but the input field is still empty. A code
            suggestions fetch is triggered when a code input in the UI gets activated.
          </li>
          <li>
            <b>Autocomplete suggestions:</b> These suggestions provide a broad set of
            possible codes for the passage that is currently being coded (i.e. has an
            active code input). These suggestions can contain multiple phrasings of
            conceptually similar ideas to maximize autocomplete matches during code
            editing. Autocomplete suggestions are triggered at the same time as code
            suggestions.
          </li>
        </ol>
        <h2 className="pt-5 font-semibold text-xl">Utilized OpenAI Models</h2>
        <ul className="max-w-[75%] list-disc ml-4 marker:font-bold flex flex-col gap-3">
          <li>
            Code suggestions and autocomplete suggestions use the <b>GPT-4.1 Mini</b> model to
            balance performance and cost.
          </li>
          <li>
            Highlight suggestions use the <b>GPT-5.1</b> model, because smaller models (mini and
            nano models) tend to struggle to consistently find the first relevant passage
            in the search area, and GPT-5 models tend to respond too slowly for this task.
          </li>
        </ul>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <span className="whitespace-nowrap pr-2">Select prompt to review:</span>
        <select
          name="reviewedPrompt"
          className="bg-transparent border border-outline rounded-sm pl-1 min-w-[100px] max-w-[300px] w-full truncate"
          value={reviewedPromptType}
          onChange={(e) => setReviewedPromptType(e.target.value as PromptType)}
        >
          {promptTypes.map((reviewedPrompt) => (
            <option key={reviewedPrompt} value={reviewedPrompt}>
              {reviewedPrompt[0].toUpperCase() +
                reviewedPrompt.slice(1).toLowerCase() +
                " suggestions"}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col bg-slate-200 rounded-md">
        <pre className="whitespace-pre-wrap break-words px-10 pt-1 pb-7">
          {reviewedPromptType === "highlight"
            ? highlightPrompt
            : reviewedPromptType === "code"
            ? codePrompt
            : autocompletePrompt}
        </pre>
      </div>
    </div>
  );
};

export default PromptReviewCardContent;

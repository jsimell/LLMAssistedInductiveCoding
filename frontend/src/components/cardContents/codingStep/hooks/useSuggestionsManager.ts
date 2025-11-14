import { useContext } from "react";
import { WorkflowContext } from "../../../../context/WorkflowContext";

export const useSuggestionManager = () => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error(
      "useSuggestionManager must be used within a WorkflowProvider"
    );
  }

  return {};
};
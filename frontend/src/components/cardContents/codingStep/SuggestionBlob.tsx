import { Passage } from "../../../context/WorkflowContext";

interface SuggestionBlobProps {
  passage: Passage;
  onClick: () => void;
}

const SuggestionBlob = ({
  passage,
  onClick,
}: SuggestionBlobProps) => {

  if (passage.isHighlighted || !passage.nextHighlightSuggestion) {
    return null;
  }

  return (
    <>
      <span
        className={`
          inline-flex items-center w-fit px-2 mr-1
        bg-gray-200 border-1 my-0.5 border-gray-400 rounded-full hover:bg-gray-300 
          text-gray-700
        `}
        onClick={onClick}
      >
        {passage.nextHighlightSuggestion?.code}
      </span>
    </>
  );
};

export default SuggestionBlob;
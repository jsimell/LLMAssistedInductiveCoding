import { Passage } from "../../../context/WorkflowContext";

interface SuggestionBlobProps {
  passage: Passage;
  onClick: (e: any) => void
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
        bg-gray-300 border-1 my-0.5 border-gray-500 rounded-full hover:bg-gray-400/70
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
import WorkspaceCard from './WorkspaceCard'
import DataUploadCardContent from './cardContents/DataUploadCardContent'
import AccessAPICardContent from './cardContents/AccessAPICardContent'
import ResearchQuestionsCardContent from './cardContents/ResearchQuestionsCardContent'
import CodingCardContent from './cardContents/codingStep/CodingCardContent'
import ResultsCardContent from './cardContents/ResultsCardContent'
import { useContext } from 'react'
import { WorkflowContext } from '../context/WorkflowContext'

function Workspace() {
  const { currentStep } = useContext(WorkflowContext);

  return (
    <>
      {currentStep === 1 && (
        <WorkspaceCard title="Step 1: Upload Data">
          <DataUploadCardContent />
        </WorkspaceCard>
      )}
      {currentStep === 2 && (
        <WorkspaceCard title="Step 2: Access OpenAI API">
          <AccessAPICardContent />
        </WorkspaceCard>
      )}
      {currentStep === 3 && (
        <WorkspaceCard title="Step 3: Research Question">
          <ResearchQuestionsCardContent />
        </WorkspaceCard>
      )}
      {currentStep === 4 && (
        <WorkspaceCard title="Step 4: Data Coding">
          <CodingCardContent />
        </WorkspaceCard>
      )}
      {currentStep === 5 && (
        <WorkspaceCard title="Step 5: Export Results">
          <ResultsCardContent />
        </WorkspaceCard>
      )}
      {(currentStep < 1 || currentStep > 5) && (
        <WorkspaceCard title="Unknown Step">
          <p>No content</p>
        </WorkspaceCard>
      )}
    </>
  );
}

export default Workspace;
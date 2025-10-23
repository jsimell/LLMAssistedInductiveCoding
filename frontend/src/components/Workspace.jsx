import WorkspaceCard from './WorkspaceCard'
import DataUploadCardContent from './cardContents/DataUploadCardContent'
import AccessAPICardContent from './cardContents/AccessAPICardContent'
import ResearchQuestionsCardContent from './cardContents/ResearchQuestionsCardContent'
import CodingCardContent from './cardContents/codingStep/CodingCardContent'
import ResultsCardContent from './cardContents/ResultsCardContent'
import ExportCardContent from './cardContents/ExportCardContent'
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
        <WorkspaceCard title="Step 5: Summary of Results">
          <ResultsCardContent />
        </WorkspaceCard>
      )}
      {currentStep === 6 && (
        <WorkspaceCard title="Step 6: Export Data">
          <ExportCardContent />
        </WorkspaceCard>
      )}
      {(currentStep < 1 || currentStep > 6) && (
        <WorkspaceCard title="Unknown Step">
          <p>No content</p>
        </WorkspaceCard>
      )}
    </>
  );
}

export default Workspace;
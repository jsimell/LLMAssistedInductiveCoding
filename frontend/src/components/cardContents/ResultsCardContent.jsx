import { useState, useContext } from "react";
import { WorkflowContext } from "../../context/WorkflowContext";

const ResultsCardContent = () => {
  const { codebook } = useContext(WorkflowContext);
  const codes = codebook[0];

  // Moving to the next step should be allowed by default in this step
  useEffect(() => {
    setProceedAvailable(true);
  });

  return (
    codes?.length ? (
      <ul>
        {codes.map((code, index) => (
          <li key={index}>{code}</li>
        ))}
      </ul>
    ) : (
      <p>No codes yet</p>
    )
  );
};

export default ResultsCardContent;
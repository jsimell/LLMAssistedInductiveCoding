import { useContext, useState, useEffect, useRef } from "react";
import { FolderArrowDownIcon, ArrowsRightLeftIcon, ArrowRightIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import { WorkflowContext } from "../../context/WorkflowContext";
import Button from "../Button";
import StepNavigationButtons from "../StepNavigationButtons";

const DataUploadCardContent = () => {
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);
  const { currentStep, fileInfo, setFileInfo, setRawData, rawData, setProceedAvailable } = useContext(WorkflowContext);
  const BrowseButtonIcon = fileInfo ? ArrowsRightLeftIcon : FolderArrowDownIcon;
  const browseButtonLabel = fileInfo ? "Change file" : "Browse files";

  // Make sure next button is available if the user returns to this screen after uploading a file previously
  useEffect(() => {
    (fileInfo && currentStep === 1)  ? setProceedAvailable(true) : null;
  }, [currentStep]);

  const handleBrowseButtonClick = () => {
    fileInputRef.current?.click();
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files && e.target.files[0];
    if (selectedFile) {
      const reader = new FileReader();
      setFileInfo(selectedFile);

      // make the loading message visible while content is loading
      reader.addEventListener("loadstart", () => {
        setIsLoading(true);
        setProceedAvailable(false);
      });
      
      // Fires when the file has been successfully read
      reader.addEventListener("load", () => {
        const fileContent = reader.result;
        setRawData(fileContent);
        setIsLoading(false);  // hide the loading message
        setProceedAvailable(true);   // allow proceeding to the next step after file has been loaded
        console.log("Raw data successfully read from file");
      });

      // Start reading the content of the file
      reader.readAsText(selectedFile);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <p>Upload your data either as a text (.txt) file or in CSV format.</p>
      <input ref={fileInputRef} id="file-input" type="file" accept="text/plain, text/csv" onChange={handleFileChange} className="hidden" />
      {isLoading && (
        <div className="pt-2">Uploading file...</div>
      )}
      {fileInfo && (
        <div className="flex justify-center gap-6 pt-2 items-center">
          <div>Uploaded file:</div>
          <i>{fileInfo.name}</i>
        </div>
      )}
      <div className="pt-5">
        <Button label={browseButtonLabel} onClick={handleBrowseButtonClick} icon={BrowseButtonIcon} iconPosition="start" variant="tertiary"></Button>
      </div>
    </div>
  );
}

export default DataUploadCardContent;
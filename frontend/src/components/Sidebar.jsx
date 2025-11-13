import StepIndicator from "./StepIndicator"

const Sidebar = () => {
  return (
    <div className="flex flex-col gap-6 p-12 bg-container">
      <StepIndicator label={"Upload Data"} idx={1}/>
      <StepIndicator label={"Access OpenAI API"} idx={2}/>
      <StepIndicator label={"Research Question"} idx={3}/>
      <StepIndicator label={"Data Coding"} idx={4}/>
      <StepIndicator label={"Export Results"} idx={5}/>
    </div>
  );
}

export default Sidebar;
const WorkspaceCardHeader = ({ title }) => {
  return (
    <div className="flex h-fit w-full justify-between items-center gap-8 px-7 py-6 border-b border-outline rounded-t-xl bg-container text-primary">
      <div className="text-3xl font-semibold">{title}</div>
    </div>
  );
}

export default WorkspaceCardHeader;
import LoadingSymbol from "./LoadingSymbol";

const InfoBox = ({ msg, icon: Icon, variant="neutral" }) => {
  const variants = {
    neutral: "bg-gray-300 text-gray-800 border-gray-800",
    error: "bg-red-300 text-red-800 border-red-800",
    success: "bg-green-300 text-green-800 border-green-800",
    loading: "bg-gray-300 text-gray-800 border-gray-800"
  }

  return (
    <div className={`flex gap-3 items-center justify-center py-2 pl-6 pr-8 rounded-xl border ${variants[variant]}`}>
      {variant === "loading" 
        ? <LoadingSymbol sizeClass="size-8" borderColorClass="border-gray-800" borderTopColorClass="border-t-gray-300"/> 
        : Icon ? <Icon className="size-10"/> : <></>}
      <span>{msg}</span>
    </div>
  );
}

export default InfoBox;
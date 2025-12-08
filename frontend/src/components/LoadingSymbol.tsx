interface LoadingSymbolProps {
  sizeClass: string; // e.g., "w-8 h-8 or size-8"
  borderColorClass: string; // e.g., "border-gray-300"
  borderTopColorClass: string; // e.g., "border-t-blue-500"
}

const LoadingSymbol = ({ sizeClass, borderColorClass, borderTopColorClass }: LoadingSymbolProps) => {
  return (
    <div className="flex justify-center items-center">
      <div className={`${sizeClass} border-3 ${borderColorClass} ${borderTopColorClass} rounded-full animate-spin`}></div>
    </div>
  )
}

export default LoadingSymbol;

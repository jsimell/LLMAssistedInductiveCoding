const SmallButton = ({ label, onClick, icon: Icon = null, iconPosition="end", variant="primary", title }) => {
  const variants = {
    primary: "bg-primaryButton text-onPrimary cursor-pointer hover:bg-primaryHover border-2 border-transparent",
    tertiary: "bg-tertiary text-onTertiary cursor-pointer hover:bg-tertiaryHover border-2 border-transparent",
    outlineTertiary: "bg-background text-tertiary border-2 border-tertiary hover:bg-gray-200 hover:ring-1 hover:ring-tertiary/30 cursor-pointer",
    disabled: "bg-gray-100 border-2 border-outline text-outline opacity-70 cursor-not-allowed"
  }

  return (
    <button 
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center w-fit h-fit text-base font-medium text-nowrap gap-1 px-2 py-1 rounded-lg hover:shadow-md ${variants[variant]}`}
    >
      {Icon && iconPosition === "start" && <Icon className="size-5" />}
      {label && <span>{label}</span>}
      {Icon && iconPosition === "end" && <Icon className="size-5" />}
    </button>
  );
}

export default SmallButton;
const Button = ({ label, onClick, icon: Icon, iconPosition="end", variant="primary", title }) => {
  const variants = {
    primary: "bg-primaryButton text-onPrimary cursor-pointer hover:bg-primaryHover border-2 border-transparent",
    tertiary: "bg-tertiary text-onTertiary cursor-pointer hover:bg-tertiaryHover border-2 border-transparent",
    disabled: "bg-gray-100 border-2 border-outline text-outline opacity-70 cursor-not-allowed"
  }

  return (
    <button 
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center w-fit h-fit text-base font-medium gap-2 px-3.5 py-2 rounded-xl ${variants[variant]}`}
    >
      {Icon && iconPosition === "start" && <Icon className="size-7" />}
      {label && <span>{label}</span>}
      {Icon && iconPosition === "end" && <Icon className="size-7" />}
    </button>
  );
}

export default Button;
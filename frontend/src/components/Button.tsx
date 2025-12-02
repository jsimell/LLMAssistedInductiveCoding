interface ButtonProps {
  label?: string;
  onClick: () => void;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  iconPosition?: "start" | "end";
  variant?: "primary" | "tertiary" | "outlineTertiary" | "disabled";
  title?: string; // Hover message
}

const Button = ({label, onClick, icon: Icon, iconPosition="end", variant="primary", title}: ButtonProps) => {
  const variants = {
    primary: "bg-primaryButton text-onPrimary cursor-pointer hover:bg-primaryHover border-2 border-transparent",
    tertiary: "bg-tertiary text-onTertiary cursor-pointer hover:bg-tertiaryHover border-2 border-transparent",
    outlineTertiary: "bg-background text-tertiary border-2 border-tertiary hover:bg-tertiaryHover hover:text-onTertiary cursor-pointer",
    disabled: "bg-gray-100 border-1 border-gray-400 text-gray-500 opacity-70 cursor-not-allowed"
  }

  return (
    <button 
      onClick={onClick}
      title={title}  // Defines the hover message
      className={`flex items-center justify-center w-fit h-fit text-base font-medium text-nowrap gap-2 px-3.5 py-2 rounded-xl shadow-md ${variants[variant]}`}
    >
      {Icon && iconPosition === "start" && <Icon className="size-7" />}
      {label && <span>{label}</span>}
      {Icon && iconPosition === "end" && <Icon className="size-7" />}
    </button>
  );
}

export default Button;
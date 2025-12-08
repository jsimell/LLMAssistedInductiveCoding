import React from "react";

interface SmallButtonProps {
  label?: string;
  onClick: () => void;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  iconPosition?: "start" | "end";
  variant?: "primary" | "tertiary" | "outlineTertiary" | "disabled";
  title?: string;
}

const SmallButton: React.FC<SmallButtonProps> = ({
  label,
  onClick,
  icon: Icon,
  iconPosition = "end",
  variant = "primary",
  title
}) => {
  const variants: Record<NonNullable<SmallButtonProps["variant"]>, string> = {
    primary: "bg-primaryButton text-onPrimary cursor-pointer hover:bg-primaryHover border-2 border-transparent",
    tertiary: "bg-tertiary text-onTertiary cursor-pointer hover:bg-tertiaryHover border-2 border-transparent",
    outlineTertiary: "bg-background text-tertiary border-2 border-tertiary hover:bg-tertiaryHover hover:text-onTertiary cursor-pointer",
    disabled: "bg-gray-100 border-2 border-outline text-outline opacity-70 cursor-not-allowed"
  };

  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center w-fit h-fit text-base font-medium text-nowrap gap-1 px-2 py-1 rounded-lg ${variants[variant]}`}
      disabled={variant === "disabled"}
    >
      {Icon && iconPosition === "start" && <Icon className="size-5 stroke-2" />}
      {label && <span>{label}</span>}
      {Icon && iconPosition === "end" && <Icon className="size-5 stroke-2" />}
    </button>
  );
};

export default SmallButton;
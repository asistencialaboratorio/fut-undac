import { ButtonHTMLAttributes } from "react";

type Variante = "primary" | "secondary" | "gold" | "danger" | "success";

const ESTILOS: Record<Variante, string> = {
  primary: "bg-azul hover:bg-azul-h text-white",
  secondary: "bg-bg-card hover:bg-bg-input text-cuerpo border border-borde",
  gold: "bg-dorado hover:bg-dorado-h text-white",
  danger: "bg-rojo hover:bg-red-700 text-white",
  success: "bg-verde hover:bg-emerald-800 text-white",
};

export default function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variante }) {
  return (
    <button
      {...props}
      className={`font-bold text-[11px] px-[18px] py-[9px] rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${ESTILOS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

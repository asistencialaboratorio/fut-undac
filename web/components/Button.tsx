import { ButtonHTMLAttributes, ReactNode } from "react";

type Variante = "primary" | "secondary" | "gold" | "danger" | "success";

const ESTILOS: Record<Variante, string> = {
  primary: "bg-azul-osc hover:bg-sb-bg text-white border border-transparent",
  secondary: "bg-bg-card hover:bg-bg-input text-cuerpo border border-borde",
  gold: "bg-dorado hover:bg-dorado-h text-white border border-transparent",
  danger: "bg-rojo hover:bg-red-700 text-white border border-transparent",
  success: "bg-verde hover:bg-emerald-800 text-white border border-transparent",
};

export default function Button({
  variant = "primary",
  className = "",
  icono,
  iconoDer,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variante; icono?: ReactNode; iconoDer?: ReactNode }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 font-semibold text-[12px] px-[16px] py-[8px] rounded-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${ESTILOS[variant]} ${className}`}
    >
      {icono}
      {children}
      {iconoDer}
    </button>
  );
}

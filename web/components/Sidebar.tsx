"use client";

import Image from "next/image";
import { CircleHelp, ClipboardList, Home, UserRound, type LucideIcon } from "lucide-react";

export type SeccionNav = "inicio" | "tramites" | "datos" | "ayuda";

const NAV_ITEMS: { clave: SeccionNav; icon: LucideIcon; label: string }[] = [
  { clave: "inicio", icon: Home, label: "Inicio" },
  { clave: "tramites", icon: ClipboardList, label: "Mis trámites" },
  { clave: "datos", icon: UserRound, label: "Mis datos" },
  { clave: "ayuda", icon: CircleHelp, label: "Ayuda y contacto" },
];

export default function Sidebar({ activo, onNav }: { activo: SeccionNav; onNav: (clave: SeccionNav) => void }) {
  return (
    <aside className="w-[220px] shrink-0 bg-sb-bg hidden md:flex flex-col h-screen sticky top-0 print:hidden">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <Image src="/img/undac_logo.jpg" alt="Logo UNDAC" width={40} height={47} className="rounded-sm" />
        <div>
          <div className="text-white font-bold text-[13px] leading-tight">FUT-UNDAC</div>
          <div className="text-sb-text text-[10px] leading-tight">
            Formulario Único
            <br />
            de Trámite
          </div>
        </div>
      </div>

      <div className="h-px bg-sb-border mx-3" />

      <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-sb-text tracking-widest">MENÚ</div>

      <nav>
        {NAV_ITEMS.map((item) => {
          const isActive = item.clave === activo;
          return (
            <button
              key={item.clave}
              onClick={() => onNav(item.clave)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                isActive ? "bg-sb-active" : "bg-sb-bg hover:bg-sb-hover"
              }`}
            >
              <span className="flex items-center gap-2">
                <item.icon size={16} strokeWidth={1.75} className={isActive ? "text-white" : "text-sb-text"} aria-hidden="true" />
                <span className={`text-[13px] ${isActive ? "text-white font-semibold" : "text-sb-text"}`}>{item.label}</span>
              </span>
              {isActive && <span className="w-[3px] self-stretch bg-sb-accent" />}
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="px-4 py-3">
        <div className="h-px bg-sb-border mb-2" />
        <div className="text-sb-text text-[10px]">v1.0 (web) — UNDAC 2026</div>
      </div>
    </aside>
  );
}

// Menú equivalente para pantallas pequeñas, donde la barra lateral se oculta.
export function NavMovil({ activo, onNav }: { activo: SeccionNav; onNav: (clave: SeccionNav) => void }) {
  return (
    <nav className="md:hidden print:hidden flex gap-1 overflow-x-auto bg-sb-bg px-2 py-2">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.clave}
          onClick={() => onNav(item.clave)}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] whitespace-nowrap ${
            item.clave === activo ? "bg-sb-active text-white font-semibold" : "text-sb-text"
          }`}
        >
          <item.icon size={14} strokeWidth={1.75} aria-hidden="true" />
          {item.label}
        </button>
      ))}
    </nav>
  );
}

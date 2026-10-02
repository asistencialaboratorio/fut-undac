"use client";

import Image from "next/image";

const NAV_ITEMS = [
  { clave: "inicio", icon: "🏠", label: "Inicio" },
  { clave: "tramites", icon: "📋", label: "Mis Trámites" },
];

export default function Sidebar({ onNav }: { onNav: (clave: string) => void }) {
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

      <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-sb-text tracking-wide">MENÚ</div>

      <nav>
        {NAV_ITEMS.map((item) => {
          const isActive = item.clave === "inicio";
          return (
            <button
              key={item.clave}
              onClick={() => onNav(item.clave)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                isActive ? "bg-sb-active" : "bg-sb-bg hover:bg-sb-hover"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-[13px]">{item.icon}</span>
                <span className={`text-[13px] ${isActive ? "text-white font-bold" : "text-sb-text"}`}>
                  {item.label}
                </span>
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

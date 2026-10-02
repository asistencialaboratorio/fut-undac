import type { ReactNode } from "react";

export default function SectionHeader({
  titulo,
  subtitulo,
  icono,
  btnLabel,
  onBtn,
}: {
  titulo: string;
  subtitulo?: string;
  icono?: ReactNode;
  btnLabel?: string;
  onBtn?: () => void;
}) {
  return (
    <div className="bg-bg-header border-b border-borde">
      <div className="h-[3px] bg-azul-osc" />
      <div className="px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {icono && (
            <span className="shrink-0 w-9 h-9 flex items-center justify-center border border-borde rounded-sm text-azul-osc">
              {icono}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-[17px] font-semibold text-titulo">{titulo}</h1>
            {subtitulo && <p className="text-[11px] text-suave mt-0.5">{subtitulo}</p>}
          </div>
        </div>
        {btnLabel && onBtn && (
          <button
            onClick={onBtn}
            className="shrink-0 text-[11px] font-semibold text-cuerpo bg-bg-card border border-borde rounded-sm px-4 py-2 hover:bg-bg-input"
          >
            {btnLabel}
          </button>
        )}
      </div>
    </div>
  );
}

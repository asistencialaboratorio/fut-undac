export default function SectionHeader({
  titulo,
  subtitulo,
  btnLabel,
  onBtn,
}: {
  titulo: string;
  subtitulo?: string;
  btnLabel?: string;
  onBtn?: () => void;
}) {
  return (
    <div className="bg-bg-header">
      <div className="h-[3px] bg-azul-osc" />
      <div className="px-6 py-3.5 flex items-center justify-between">
        <div>
          <h1 className="text-[16px] font-bold text-titulo">{titulo}</h1>
          {subtitulo && <p className="text-[11px] text-suave mt-0.5">{subtitulo}</p>}
        </div>
        {btnLabel && onBtn && (
          <button
            onClick={onBtn}
            className="text-[11px] font-bold text-cuerpo bg-bg-card border border-borde rounded px-4 py-2 hover:bg-bg-input"
          >
            {btnLabel}
          </button>
        )}
      </div>
    </div>
  );
}

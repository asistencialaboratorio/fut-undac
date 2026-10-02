import { completarCorreo } from "@/lib/validadores";

export default function Campo({
  clave,
  etiqueta,
  obligatorio,
  placeholder,
  ayuda,
  error,
  valor,
  onChange,
  opciones,
}: {
  clave: string;
  etiqueta: string;
  obligatorio: boolean;
  placeholder: string;
  ayuda: string;
  error?: string;
  valor: string;
  onChange: (v: string) => void;
  opciones?: string[];
}) {
  const esArea = clave === "domicilio" || clave === "fundamentacion_libre";
  const claseBase = `w-full border rounded-sm px-2.5 py-2 text-[12px] bg-bg-card focus:outline-none focus:border-borde-focus ${
    error ? "border-rojo" : "border-borde"
  }`;
  return (
    <div>
      <label className="block text-[11px] font-semibold text-titulo mb-1">
        {etiqueta} {obligatorio && <span className="text-rojo">*</span>}
      </label>
      {opciones ? (
        <select className={claseBase} value={valor} onChange={(e) => onChange(e.target.value)}>
          <option value="">-- Selecciona --</option>
          {opciones.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : esArea ? (
        <textarea className={claseBase} placeholder={placeholder} value={valor} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          className={claseBase}
          placeholder={placeholder}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          onBlur={clave === "correo" ? () => onChange(completarCorreo(valor)) : undefined}
        />
      )}
      {error ? (
        <p className="text-[10px] text-rojo mt-1">{error}</p>
      ) : ayuda ? (
        <p className="text-[10px] text-hint mt-1">{ayuda}</p>
      ) : null}
    </div>
  );
}

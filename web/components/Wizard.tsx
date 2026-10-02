"use client";

import { useMemo, useState } from "react";
import { descargarBlob, descargarPdfDesdeHoja } from "@/lib/pdf-cliente";
import { CATALOGO, FRECUENTES, ICONOS, listarTramites } from "@/lib/catalogo";
import { CAMPOS_CONFIG } from "@/lib/campos";
import { listarFacultades, listarEscuelas } from "@/lib/facultades";
import { validarCampo } from "@/lib/validadores";
import { construirFut } from "@/lib/constructor";
import { sugerirTramites } from "@/lib/sugeridor";
import FutDocument, { HojaA4, type CampoEditable } from "./FutDocument";
import Sidebar from "./Sidebar";
import SectionHeader from "./SectionHeader";
import Button from "./Button";

type Paso = "inicio" | "formulario" | "fundamentacion" | "vista_previa";

const ETIQUETAS_EXTRA: Record<string, string> = {
  periodo: "Periodo académico",
  motivo_uso: "¿Para qué lo necesitas?",
  area_adeudo: "Área (Biblioteca, Economía, etc.)",
  tercio_quinto_texto: "Ubicación en tercio/quinto superior (opcional)",
  escuela_origen: "Escuela de origen",
  escuela_destino: "Escuela de destino",
  motivo_traslado: "Motivo del traslado",
  universidad_origen: "Universidad de origen",
  carrera_origen: "Carrera de origen",
  motivo_reserva: "Motivo de la reserva",
  curso: "Curso",
  motivo_rectificacion: "Motivo de la rectificación",
  institucion_practicas: "Institución de prácticas",
  motivo_expediente: "Trámite del expediente original",
  motivo_duplicado: "Motivo del duplicado",
  motivo_subsanacion: "Descripción de la omisión/error",
  concepto_exoneracion: "Concepto a exonerar (matrícula, comedor...)",
  solicito_libre: "¿Qué solicitas? (título)",
  sumilla_libre: "Resumen breve del pedido",
  destinatario_libre: "¿A quién va dirigido?",
  fundamentacion_libre: "Describe tu pedido con más detalle",
};

function nombreArchivo(nombresApellidos: string, claveTramite: string) {
  const apellido = (nombresApellidos || "estudiante").trim().split(/\s+/)[0] || "estudiante";
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const slug = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  return `FUT_${slug(claveTramite)}_${slug(apellido)}_${fecha}`;
}

export default function Wizard() {
  const [paso, setPaso] = useState<Paso>("inicio");
  const [claveTramite, setClaveTramite] = useState<string | null>(null);
  const [datos, setDatos] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [busqueda, setBusqueda] = useState("");
  const [sugerencias, setSugerencias] = useState<ReturnType<typeof sugerirTramites>>([]);
  const [buscado, setBuscado] = useState(false);

  // ── Autocompletar con la API institucional de la UNDAC ──
  const [codApi, setCodApi] = useState("");
  const [estadoApi, setEstadoApi] = useState<{ texto: string; tipo: "info" | "ok" | "error" } | null>(null);
  const [consultando, setConsultando] = useState(false);

  const tramites = useMemo(() => listarTramites(), []);
  const resto = tramites.filter((t) => !FRECUENTES.includes(t.clave));

  function elegirTramite(clave: string) {
    setClaveTramite(clave);
    setErrores({});
    setPaso("formulario");
  }

  function buscar() {
    setBuscado(true);
    setSugerencias(busqueda.trim() ? sugerirTramites(busqueda) : []);
  }

  function actualizarCampo(clave: string, valor: string) {
    setDatos((d) => {
      const nuevo = { ...d, [clave]: valor };
      if (clave === "facultad") {
        const escuelasValidas = listarEscuelas(valor);
        if (escuelasValidas.length && !escuelasValidas.includes(nuevo.escuela)) {
          nuevo.escuela = "";
        }
      }
      return nuevo;
    });
  }

  async function consultarApi() {
    const codigo = codApi.trim();
    if (!codigo) {
      setEstadoApi({ texto: "Ingresa un código", tipo: "error" });
      return;
    }
    setConsultando(true);
    setEstadoApi({ texto: "⏳ Consultando...", tipo: "info" });
    try {
      const resp = await fetch("/api/consultar-estudiante", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const info = await resp.json();
      if (!resp.ok) throw new Error(info.error || "Error desconocido");
      setDatos((d) => ({
        ...d,
        nombres_apellidos: info.nombresApellidos || d.nombres_apellidos,
        dni: info.dni || d.dni,
        correo: info.correoInstitucional || d.correo,
        codigo,
        facultad: info.facultad || d.facultad,
        escuela: info.escuela || d.escuela,
        domicilio: info.domicilio || d.domicilio,
      }));
      const nombre = info.nombresApellidos ? String(info.nombresApellidos).split(" ").pop() : "";
      setEstadoApi({ texto: `✓ Datos de ${nombre} cargados`, tipo: "ok" });
    } catch (e) {
      setEstadoApi({ texto: `✗ ${e instanceof Error ? e.message : "Error desconocido"}`, tipo: "error" });
    } finally {
      setConsultando(false);
    }
  }

  function validarFormulario(): boolean {
    if (!claveTramite) return false;
    const tramite = CATALOGO[claveTramite];
    const nuevosErrores: Record<string, string> = {};
    for (const campo of CAMPOS_CONFIG) {
      const valor = (datos[campo.clave] || "").trim();
      if (campo.obligatorio && !valor) {
        nuevosErrores[campo.clave] = "Obligatorio";
        continue;
      }
      if (valor) {
        const msg = validarCampo(campo.validador, valor);
        if (msg) nuevosErrores[campo.clave] = msg;
      }
    }
    const opcionales = new Set(tramite.camposExtraOpcionales ?? []);
    for (const campo of tramite.camposExtra) {
      if (!opcionales.has(campo) && !(datos[campo] || "").trim()) {
        nuevosErrores[campo] = "Obligatorio";
      }
    }
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  const textoFundamentacionSugerido = useMemo(() => {
    if (!claveTramite) return "";
    try {
      return construirFut(claveTramite, datos).fundamentacion;
    } catch {
      return "";
    }
  }, [claveTramite, datos]);

  const [fundamentacion, setFundamentacion] = useState("");

  function irAFundamentacion() {
    if (!validarFormulario()) return;
    setFundamentacion(textoFundamentacionSugerido);
    setPaso("fundamentacion");
  }

  const futFinal = useMemo(() => {
    if (!claveTramite) return null;
    return construirFut(claveTramite, { ...datos, fundamentacion });
  }, [claveTramite, datos, fundamentacion]);

  function irANav(clave: string) {
    void clave;
    setPaso("inicio");
  }

  return (
    <div className="flex min-h-screen bg-bg-main print:block print:min-h-0">
      <Sidebar onNav={irANav} />
      <div className="flex-1 min-w-0">
        {paso === "inicio" && (
          <PantallaInicio
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            buscar={buscar}
            buscado={buscado}
            sugerencias={sugerencias}
            elegirTramite={elegirTramite}
            resto={resto}
          />
        )}

        {paso === "formulario" && claveTramite && (
          <PantallaFormulario
            claveTramite={claveTramite}
            datos={datos}
            errores={errores}
            actualizarCampo={actualizarCampo}
            codApi={codApi}
            setCodApi={setCodApi}
            estadoApi={estadoApi}
            consultando={consultando}
            consultarApi={consultarApi}
            onVolver={() => setPaso("inicio")}
            onContinuar={irAFundamentacion}
          />
        )}

        {paso === "fundamentacion" && claveTramite && (
          <PantallaFundamentacion
            fundamentacion={fundamentacion}
            setFundamentacion={setFundamentacion}
            textoSugerido={textoFundamentacionSugerido}
            onVolver={() => setPaso("formulario")}
            onContinuar={() => setPaso("vista_previa")}
          />
        )}

        {paso === "vista_previa" && futFinal && (
          <PantallaVistaPrevia
            futInicial={futFinal}
            onEditar={() => setPaso("fundamentacion")}
            onNuevo={() => {
              setClaveTramite(null);
              setDatos({});
              setPaso("inicio");
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Pantalla 1: Inicio ──────────────────────────────────────────
function PantallaInicio({
  busqueda,
  setBusqueda,
  buscar,
  buscado,
  sugerencias,
  elegirTramite,
  resto,
}: {
  busqueda: string;
  setBusqueda: (v: string) => void;
  buscar: () => void;
  buscado: boolean;
  sugerencias: ReturnType<typeof sugerirTramites>;
  elegirTramite: (clave: string) => void;
  resto: Array<{ clave: string; nombre: string }>;
}) {
  return (
    <>
      <SectionHeader titulo="¿Qué trámite necesitas hoy?" subtitulo="Selecciona el tipo de documento que deseas generar" />
      <div className="px-6 py-5">
        <div className="bg-bg-card border border-borde rounded p-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="text-suave text-[13px]">🔍</span>
            <input
              className="flex-1 bg-transparent text-[12px] outline-none text-titulo placeholder:text-hint"
              placeholder="Describe lo que necesitas (ej: 'se me perdió mi carné')..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
            />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <Button variant="gold" onClick={buscar}>
              🔍 Sugerir trámite
            </Button>
            <span className="text-[10px] text-hint">o selecciona directamente abajo</span>
          </div>
          {buscado && sugerencias.length === 0 && (
            <p className="text-[11px] text-suave mt-3">
              No encontré un trámite que coincida. Elige uno de la lista de abajo, o usa &quot;Otro trámite&quot; para
              redactar uno libre.
            </p>
          )}
          {sugerencias.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {sugerencias.map((s, i) => (
                <button
                  key={s.clave}
                  onClick={() => elegirTramite(s.clave)}
                  className={`text-left px-3 py-2 rounded text-[12px] font-bold ${
                    i === 0 ? "bg-azul hover:bg-azul-h text-white" : "bg-bg-input text-cuerpo hover:bg-borde"
                  }`}
                >
                  {ICONOS[s.clave] ?? "📄"} {s.nombre} →
                </button>
              ))}
            </div>
          )}
        </div>

        <DividerLabel texto="⭐  Trámites Frecuentes" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-6">
          {FRECUENTES.map((clave) => (
            <TarjetaTramite key={clave} clave={clave} esFrecuente onClick={() => elegirTramite(clave)} />
          ))}
        </div>

        <DividerLabel texto="📋  Todos los Trámites" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {resto.map((t) => (
            <TarjetaTramite key={t.clave} clave={t.clave} onClick={() => elegirTramite(t.clave)} />
          ))}
        </div>
      </div>
    </>
  );
}

function DividerLabel({ texto }: { texto: string }) {
  return <div className="text-[11px] font-bold text-suave mb-2.5 mt-1">{texto}</div>;
}

function TarjetaTramite({
  clave,
  esFrecuente = false,
  onClick,
}: {
  clave: string;
  esFrecuente?: boolean;
  onClick: () => void;
}) {
  const t = CATALOGO[clave];
  return (
    <button
      onClick={onClick}
      className="group flex items-stretch text-left bg-bg-card border border-borde-card rounded-none hover:border-azul transition-colors overflow-hidden"
    >
      <span className={`w-1 shrink-0 ${esFrecuente ? "bg-dorado" : "bg-azul-osc"}`} />
      <span className="flex-1 px-3.5 py-3 group-hover:bg-[#eef2ff] transition-colors">
        <span className="flex items-center justify-between">
          <span className="text-lg">{ICONOS[clave] ?? "📄"}</span>
          {esFrecuente && (
            <span className="text-[9px] font-bold bg-[#fef3c7] text-[#92400e] px-1 py-0.5 rounded">★ Frecuente</span>
          )}
        </span>
        <span className="block text-[12px] font-bold text-titulo mt-1.5">{t.nombre}</span>
        <span className="block text-right text-[13px] text-hint group-hover:text-azul mt-1">→</span>
      </span>
    </button>
  );
}

// ── Pantalla 2: Formulario ──────────────────────────────────────
function PantallaFormulario({
  claveTramite,
  datos,
  errores,
  actualizarCampo,
  codApi,
  setCodApi,
  estadoApi,
  consultando,
  consultarApi,
  onVolver,
  onContinuar,
}: {
  claveTramite: string;
  datos: Record<string, string>;
  errores: Record<string, string>;
  actualizarCampo: (clave: string, valor: string) => void;
  codApi: string;
  setCodApi: (v: string) => void;
  estadoApi: { texto: string; tipo: "info" | "ok" | "error" } | null;
  consultando: boolean;
  consultarApi: () => void;
  onVolver: () => void;
  onContinuar: () => void;
}) {
  const tramite = CATALOGO[claveTramite];
  const escuelasDisponibles = listarEscuelas(datos.facultad) ?? [];

  return (
    <>
      <SectionHeader
        titulo={`${ICONOS[claveTramite] ?? "📄"}  ${tramite.nombre}`}
        subtitulo="Paso 1 de 3 — Completa tus datos personales"
        btnLabel="← Cambiar trámite"
        onBtn={onVolver}
      />
      <div className="px-6 py-5 max-w-3xl">
        <Pasos actual={1} />

        <div className="bg-bg-card border border-borde rounded p-4 mb-5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-titulo">🔍  Autocompletar con código de matrícula</span>
            {estadoApi && (
              <span
                className={`text-[10px] font-medium ${
                  estadoApi.tipo === "ok" ? "text-verde" : estadoApi.tipo === "error" ? "text-rojo" : "text-suave"
                }`}
              >
                {estadoApi.texto}
              </span>
            )}
          </div>
          <p className="text-[10px] text-suave mt-1 mb-2.5">
            El sistema consulta la API de UNDAC y completa tu nombre, DNI, correo institucional, facultad,
            escuela y domicilio automáticamente.
          </p>
          <div className="flex gap-2">
            <input
              className="border border-borde rounded px-2.5 py-1.5 text-[12px] w-44"
              value={codApi}
              onChange={(e) => setCodApi(e.target.value)}
              placeholder="Código de matrícula"
              inputMode="numeric"
            />
            <Button variant="primary" onClick={consultarApi} disabled={consultando}>
              🔍 Consultar API
            </Button>
          </div>
        </div>

        <DividerLabel texto="Datos Personales" />
        <div className="bg-bg-card border border-borde rounded p-5 space-y-4">
          {CAMPOS_CONFIG.map((campo) => (
            <Campo
              key={campo.clave}
              clave={campo.clave}
              etiqueta={campo.etiqueta}
              obligatorio={campo.obligatorio}
              placeholder={campo.placeholder}
              ayuda={campo.ayuda}
              error={errores[campo.clave]}
              valor={datos[campo.clave] || ""}
              onChange={(v) => actualizarCampo(campo.clave, v)}
              opciones={
                campo.clave === "facultad"
                  ? listarFacultades()
                  : campo.clave === "escuela"
                    ? escuelasDisponibles
                    : undefined
              }
            />
          ))}

          {tramite.camposExtra.length > 0 && (
            <>
              <div className="border-t border-borde pt-4 text-[12px] font-bold text-suave">
                Datos del trámite: {tramite.nombre}
              </div>
              <p className="text-[10px] text-suave -mt-2">{tramite.ayuda}</p>
              {tramite.camposExtra.map((clave) => (
                <Campo
                  key={clave}
                  clave={clave}
                  etiqueta={ETIQUETAS_EXTRA[clave] ?? clave.replace(/_/g, " ")}
                  obligatorio={!(tramite.camposExtraOpcionales ?? []).includes(clave)}
                  placeholder=""
                  ayuda=""
                  error={errores[clave]}
                  valor={datos[clave] || ""}
                  onChange={(v) => actualizarCampo(clave, v)}
                />
              ))}
            </>
          )}
        </div>

        <div className="flex justify-between mt-5 pb-8">
          <button onClick={onVolver} className="text-suave text-[12px] font-bold">
            ← Cambiar trámite
          </button>
          <Button variant="primary" onClick={onContinuar}>
            Continuar →
          </Button>
        </div>
      </div>
    </>
  );
}

function Pasos({ actual }: { actual: 1 | 2 | 3 }) {
  const pasos = ["Datos personales", "Fundamentación", "Vista previa"];
  return (
    <div className="flex items-center gap-1.5 mb-5">
      {pasos.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          <span
            className={`px-2 py-1 rounded text-[10px] font-bold ${
              i + 1 === actual ? "bg-azul text-white" : "bg-borde text-suave"
            }`}
          >
            {i + 1}. {p}
          </span>
          {i < 2 && <span className="text-hint text-[10px]">›</span>}
        </span>
      ))}
    </div>
  );
}

function Campo({
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
  const claseBase = `w-full border rounded px-2.5 py-2 text-[12px] bg-bg-card focus:outline-none focus:border-borde-focus ${
    error ? "border-rojo" : "border-borde"
  }`;
  return (
    <div>
      <label className="block text-[11px] font-bold text-titulo mb-1">
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
        <input className={claseBase} placeholder={placeholder} value={valor} onChange={(e) => onChange(e.target.value)} />
      )}
      {error ? (
        <p className="text-[10px] text-rojo mt-1">{error}</p>
      ) : ayuda ? (
        <p className="text-[10px] text-hint mt-1">{ayuda}</p>
      ) : null}
    </div>
  );
}

// ── Pantalla 3: Fundamentación ────────────────────────────────
function PantallaFundamentacion({
  fundamentacion,
  setFundamentacion,
  textoSugerido,
  onVolver,
  onContinuar,
}: {
  fundamentacion: string;
  setFundamentacion: (v: string) => void;
  textoSugerido: string;
  onVolver: () => void;
  onContinuar: () => void;
}) {
  return (
    <>
      <SectionHeader
        titulo="✍️ Fundamentación del pedido"
        subtitulo="Paso 2 de 3 — Revisa o edita el texto legal generado automáticamente"
        btnLabel="← Volver"
        onBtn={onVolver}
      />
      <div className="px-6 py-5 max-w-3xl">
        <Pasos actual={2} />

        <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded p-3 mb-4">
          <p className="text-[11px] text-[#1e40af]">
            💡 El texto legal fue generado con tus datos. Puedes usarlo tal cual o editarlo libremente.
          </p>
        </div>

        <textarea
          className="w-full border border-borde rounded p-4 text-[12px] min-h-[220px] bg-bg-card focus:outline-none focus:border-borde-focus"
          value={fundamentacion}
          onChange={(e) => setFundamentacion(e.target.value)}
        />

        <div className="flex justify-between mt-5 pb-8">
          <button onClick={onVolver} className="text-suave text-[12px] font-bold">
            ← Volver
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setFundamentacion(textoSugerido)}>
              🔄 Regenerar
            </Button>
            <Button variant="primary" onClick={onContinuar}>
              Vista previa →
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Pantalla 4: Vista previa ──────────────────────────────────
function PantallaVistaPrevia({
  futInicial,
  onEditar,
  onNuevo,
}: {
  futInicial: ReturnType<typeof construirFut>;
  onEditar: () => void;
  onNuevo: () => void;
}) {
  const [fut, setFut] = useState(futInicial);
  const [ocupado, setOcupado] = useState<"word" | "pdf" | null>(null);
  const [error, setError] = useState("");
  const [desborda, setDesborda] = useState(false);

  function editarCampo(campo: CampoEditable, valor: string) {
    setFut((f) => ({ ...f, [campo]: valor }));
  }

  function nombreBase() {
    return nombreArchivo(fut.nombresApellidos, fut.tramiteClave);
  }

  async function descargarWord() {
    setOcupado("word");
    setError("");
    try {
      const resp = await fetch("/api/generar-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fut, nombreArchivo: nombreBase() }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "" }));
        throw new Error(err.error || "No se pudo generar el documento.");
      }
      descargarBlob(await resp.blob(), `${nombreBase()}.docx`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setOcupado(null);
    }
  }

  async function descargarPdf() {
    const hoja = document.getElementById("fut-document");
    if (!hoja) return;
    (document.activeElement as HTMLElement | null)?.blur();
    setOcupado("pdf");
    setError("");
    try {
      await descargarPdfDesdeHoja(hoja, `${nombreBase()}.pdf`);
    } catch (e) {
      setError(`No se pudo generar el PDF: ${e instanceof Error ? e.message : "error desconocido"}`);
    } finally {
      setOcupado(null);
    }
  }

  function imprimir() {
    (document.activeElement as HTMLElement | null)?.blur();
    window.print();
  }

  return (
    <>
      <div className="print:hidden">
        <SectionHeader titulo="👁 Vista previa del FUT" subtitulo="Revisa tu documento, edítalo si hace falta y descárgalo o imprímelo" />
        <div className="px-6 pt-4">
          <Pasos actual={3} />
        </div>
      </div>

      <div className="print:hidden sticky top-0 z-20 bg-bg-main px-6 pb-3 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onEditar} className="text-suave text-[12px] font-bold px-2">
            ← Editar
          </button>
          <Button variant="primary" onClick={descargarWord} disabled={ocupado !== null}>
            {ocupado === "word" ? "Generando Word..." : "⬇ Descargar Word"}
          </Button>
          <Button variant="primary" onClick={descargarPdf} disabled={ocupado !== null}>
            {ocupado === "pdf" ? "Generando PDF..." : "⬇ Descargar PDF"}
          </Button>
          <Button variant="success" onClick={imprimir} disabled={ocupado !== null}>
            🖨 Imprimir
          </Button>
        </div>
        <p className="text-[10px] text-hint mt-1.5">
          ✏️ Haz clic sobre cualquier texto de la hoja para editarlo; los cambios se reflejan en el Word, el PDF y la
          impresión. Nada se guarda en el servidor.
        </p>
        {desborda && (
          <p className="text-[11px] text-naranja mt-1">
            ⚠ El texto no cabe en una hoja A4 ni reduciendo la letra al mínimo. Acórtalo para que se imprima completo.
          </p>
        )}
        {error && <p className="text-[11px] text-rojo mt-1">{error}</p>}
      </div>

      <div className="px-6 pb-6 print:p-0">
        <HojaA4>
          <FutDocument fut={fut} onChange={editarCampo} onDesborde={setDesborda} />
        </HojaA4>
      </div>

      <div className="print:hidden px-6 pb-10 text-center">
        <button onClick={onNuevo} className="text-azul text-[12px] font-bold">
          + Nuevo trámite
        </button>
      </div>
    </>
  );
}

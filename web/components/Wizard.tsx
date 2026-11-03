"use client";

import { useMemo, useState } from "react";
import { descargarBlob, descargarPdfDesdeHoja } from "@/lib/pdf-cliente";
import { ArrowLeft, ArrowRight, Check, Download, Eye, Info, Pencil, PencilLine, Plus, Printer, RefreshCw, Save, Search, TriangleAlert, X } from "lucide-react";
import { CATALOGO, FRECUENTES, listarTramites } from "@/lib/catalogo";
import { IconoTramite } from "./Iconos";
import { CAMPOS_CONFIG } from "@/lib/campos";
import { listarFacultades, listarEscuelas } from "@/lib/facultades";
import { completarCorreo, validarCampo } from "@/lib/validadores";
import { construirFut, type FutData } from "@/lib/constructor";
import { agregarAlHistorial, cargarPerfil, guardarPerfil } from "@/lib/almacen";
import { sugerirTramites } from "@/lib/sugeridor";
import FutDocument, { HojaA4, type CampoEditable } from "./FutDocument";
import Sidebar, { NavMovil, type SeccionNav } from "./Sidebar";
import Campo from "./Campo";
import { PantallaAyuda, PantallaMisDatos, PantallaMisTramites } from "./PantallasExtra";
import SectionHeader from "./SectionHeader";
import Button from "./Button";

type Paso = SeccionNav | "formulario" | "fundamentacion" | "vista_previa";

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
  const [futAbierto, setFutAbierto] = useState<FutData | null>(null);
  const [claveVista, setClaveVista] = useState(0);

  // ── Autocompletar con la API institucional de la UNDAC ──
  const [codApi, setCodApi] = useState("");
  const [estadoApi, setEstadoApi] = useState<{ texto: string; tipo: "info" | "ok" | "error" } | null>(null);
  const [consultando, setConsultando] = useState(false);

  const tramites = useMemo(() => listarTramites(), []);
  const resto = tramites.filter((t) => !FRECUENTES.includes(t.clave));

  function elegirTramite(clave: string) {
    setClaveTramite(clave);
    setFutAbierto(null);
    setErrores({});
    setDatos((d) => (Object.keys(d).length ? d : cargarPerfil()));
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
    setEstadoApi({ texto: "Consultando...", tipo: "info" });
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
        correo: info.correoInstitucional || d.correo,
        codigo,
        facultad: info.facultad || d.facultad,
        escuela: info.escuela || d.escuela,
      }));
      const nombre = info.nombresApellidos ? String(info.nombresApellidos).split(" ").pop() : "";
      setEstadoApi({ texto: `Datos de ${nombre} cargados`, tipo: "ok" });
    } catch (e) {
      setEstadoApi({ texto: `${e instanceof Error ? e.message : "Error desconocido"}`, tipo: "error" });
    } finally {
      setConsultando(false);
    }
  }

  function validarFormulario(): boolean {
    if (!claveTramite) return false;
    const tramite = CATALOGO[claveTramite];
    const nuevosErrores: Record<string, string> = {};
    const correo = completarCorreo(datos.correo || "");
    if (correo !== (datos.correo || "")) setDatos((d) => ({ ...d, correo }));
    const dat: Record<string, string> = { ...datos, correo };
    for (const campo of CAMPOS_CONFIG) {
      const valor = (dat[campo.clave] || "").trim();
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
      if (!opcionales.has(campo) && !(dat[campo] || "").trim()) {
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

  function irANav(seccion: SeccionNav) {
    setPaso(seccion);
  }

  function nuevoTramite() {
    setClaveTramite(null);
    setFutAbierto(null);
    setDatos({});
    setPaso("inicio");
  }

  const seccionActiva: SeccionNav = paso === "tramites" || paso === "datos" || paso === "ayuda" ? paso : "inicio";
  const futVista = futAbierto ?? futFinal;

  return (
    <div className="flex min-h-screen bg-bg-main print:block print:min-h-0">
      <Sidebar activo={seccionActiva} onNav={irANav} />
      <div className="flex-1 min-w-0">
        <NavMovil activo={seccionActiva} onNav={irANav} />
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
            onGuardarDatos={() => guardarPerfil(datos)}
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
            onContinuar={() => {
              setFutAbierto(null);
              setPaso("vista_previa");
            }}
          />
        )}

        {paso === "vista_previa" && futVista && (
          <PantallaVistaPrevia
            key={claveVista}
            futInicial={futVista}
            onEditar={() => setPaso(futAbierto ? "tramites" : "fundamentacion")}
            onNuevo={nuevoTramite}
            onGenerado={agregarAlHistorial}
          />
        )}

        {paso === "tramites" && (
          <PantallaMisTramites
            onAbrir={(fut) => {
              setFutAbierto(fut);
              setClaveVista((n) => n + 1);
              setPaso("vista_previa");
            }}
            onNuevo={nuevoTramite}
          />
        )}

        {paso === "datos" && <PantallaMisDatos onNuevo={nuevoTramite} />}

        {paso === "ayuda" && <PantallaAyuda onNuevo={nuevoTramite} />}
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
        <div className="bg-bg-card border border-borde rounded-sm p-3 mb-5">
          <div className="flex items-center gap-2">
            <Search size={15} strokeWidth={1.75} className="text-suave" />
            <input
              className="flex-1 bg-transparent text-[12px] outline-none text-titulo placeholder:text-hint"
              placeholder="Describe lo que necesitas (ej: 'se me perdió mi carné')..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
            />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <Button variant="gold" onClick={buscar} icono={<Search size={14} />}>
              Sugerir trámite
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
                  className={`flex items-center gap-2 text-left px-3 py-2 rounded-sm text-[12px] font-semibold ${
                    i === 0 ? "bg-azul-osc hover:bg-sb-bg text-white" : "bg-bg-input text-cuerpo hover:bg-borde"
                  }`}
                >
                  <IconoTramite clave={s.clave} size={16} />
                  <span className="flex-1">{s.nombre}</span>
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
          )}
        </div>

        <DividerLabel texto="Trámites frecuentes" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-6">
          {FRECUENTES.map((clave) => (
            <TarjetaTramite key={clave} clave={clave} esFrecuente onClick={() => elegirTramite(clave)} />
          ))}
        </div>

        <DividerLabel texto="Todos los trámites" />
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
  return <div className="text-[10px] font-semibold uppercase tracking-widest text-suave mb-2.5 mt-1">{texto}</div>;
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
      className="group flex items-stretch text-left bg-bg-card border border-borde rounded-sm hover:border-azul-osc transition-colors overflow-hidden"
    >
      <span className="flex-1 px-4 py-3.5">
        <span className="flex items-center justify-between">
          <span className="w-8 h-8 flex items-center justify-center border border-borde rounded-sm text-azul-osc group-hover:border-azul-osc">
            <IconoTramite clave={clave} size={17} />
          </span>
          {esFrecuente && (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-dorado-h border border-dorado px-1.5 py-0.5 rounded-sm">
              Frecuente
            </span>
          )}
        </span>
        <span className="block text-[12.5px] font-semibold text-titulo mt-2.5 leading-snug">{t.nombre}</span>
        <span className="flex justify-end mt-1.5 text-hint group-hover:text-azul-osc">
          <ArrowRight size={14} />
        </span>
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
  onGuardarDatos,
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
  onGuardarDatos: () => boolean;
  onVolver: () => void;
  onContinuar: () => void;
}) {
  const [guardado, setGuardado] = useState("");
  const tramite = CATALOGO[claveTramite];
  const escuelasDisponibles = listarEscuelas(datos.facultad) ?? [];

  return (
    <>
      <SectionHeader
        titulo={tramite.nombre}
        icono={<IconoTramite clave={claveTramite} />}
        subtitulo="Paso 1 de 3 — Completa tus datos personales"
        btnLabel="Cambiar trámite"
        onBtn={onVolver}
      />
      <div className="px-6 py-5 max-w-3xl">
        <Pasos actual={1} />

        <div className="bg-bg-card border border-borde rounded-sm p-4 mb-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] font-semibold text-titulo"><Search size={14} strokeWidth={1.75} className="text-azul-osc" />Autocompletar con código de matrícula</span>
            {estadoApi && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                  estadoApi.tipo === "ok" ? "text-verde" : estadoApi.tipo === "error" ? "text-rojo" : "text-suave"
                }`}
              >
                {estadoApi.tipo === "ok" && <Check size={12} />}
                {estadoApi.tipo === "error" && <X size={12} />}
                {estadoApi.texto}
              </span>
            )}
          </div>
          <p className="text-[10px] text-suave mt-1 mb-2.5">
            El sistema consulta la API de UNDAC y completa tu nombre, correo institucional, facultad y
            escuela automáticamente. El DNI y el domicilio se escriben a mano.
          </p>
          <div className="flex gap-2">
            <input
              className="border border-borde rounded-sm px-2.5 py-1.5 text-[12px] w-44"
              value={codApi}
              onChange={(e) => setCodApi(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !consultando) consultarApi();
              }}
              placeholder="Código de matrícula"
              inputMode="numeric"
            />
            <Button variant="primary" onClick={consultarApi} disabled={consultando} icono={<Search size={14} />}>
              Consultar
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <Button
            variant="secondary"
            icono={<Save size={14} />}
            onClick={() =>
              setGuardado(onGuardarDatos() ? "Guardados en este navegador; se completarán solos la próxima vez." : "No se pudo guardar.")
            }
          >
            Guardar mis datos para próximos trámites
          </Button>
          {guardado && <span className="text-[10px] text-suave">{guardado}</span>}
        </div>

        <DividerLabel texto="Datos Personales" />
        <div className="bg-bg-card border border-borde rounded-sm p-5 space-y-4">
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
          <button onClick={onVolver} className="inline-flex items-center gap-1.5 text-suave text-[12px] font-semibold">
            <ArrowLeft size={14} />
            Cambiar trámite
          </button>
          <Button variant="primary" onClick={onContinuar} iconoDer={<ArrowRight size={14} />}>
            Continuar
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
            className={`px-2.5 py-1 rounded-sm text-[10px] font-semibold ${
              i + 1 === actual ? "bg-azul-osc text-white" : "bg-borde text-suave"
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
        titulo="Fundamentación del pedido"
        icono={<PencilLine size={18} strokeWidth={1.75} />}
        subtitulo="Paso 2 de 3 — Revisa o edita el texto legal generado automáticamente"
        btnLabel="Volver"
        onBtn={onVolver}
      />
      <div className="px-6 py-5 max-w-3xl">
        <Pasos actual={2} />

        <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-sm p-3 mb-4">
          <p className="flex items-center gap-2 text-[11px] text-[#1e40af]">
            <Info size={14} className="shrink-0" />
            El texto legal fue generado con tus datos. Puedes usarlo tal cual o editarlo libremente.
          </p>
        </div>

        <textarea
          className="w-full border border-borde rounded-sm p-4 text-[12px] min-h-[220px] bg-bg-card focus:outline-none focus:border-borde-focus"
          value={fundamentacion}
          onChange={(e) => setFundamentacion(e.target.value)}
        />

        <div className="flex justify-between mt-5 pb-8">
          <button onClick={onVolver} className="inline-flex items-center gap-1.5 text-suave text-[12px] font-semibold">
            <ArrowLeft size={14} />
            Volver
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setFundamentacion(textoSugerido)} icono={<RefreshCw size={14} />}>
              Regenerar
            </Button>
            <Button variant="primary" onClick={onContinuar} iconoDer={<ArrowRight size={14} />}>
              Vista previa
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
  onGenerado,
}: {
  futInicial: ReturnType<typeof construirFut>;
  onEditar: () => void;
  onNuevo: () => void;
  onGenerado: (fut: FutData) => void;
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
      onGenerado(fut);
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
      onGenerado(fut);
    } catch (e) {
      setError(`No se pudo generar el PDF: ${e instanceof Error ? e.message : "error desconocido"}`);
    } finally {
      setOcupado(null);
    }
  }

  function imprimir() {
    (document.activeElement as HTMLElement | null)?.blur();
    onGenerado(fut);
    window.print();
  }

  return (
    <>
      <div className="print:hidden">
        <SectionHeader icono={<Eye size={18} strokeWidth={1.75} />} titulo="Vista previa del FUT" subtitulo="Revisa tu documento, edítalo si hace falta y descárgalo o imprímelo" />
        <div className="px-6 pt-4">
          <Pasos actual={3} />
        </div>
      </div>

      <div className="print:hidden sticky top-0 z-20 bg-bg-main px-6 pb-3 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onEditar} className="inline-flex items-center gap-1.5 text-suave text-[12px] font-semibold px-2">
            <ArrowLeft size={14} />
            Editar
          </button>
          <Button variant="primary" onClick={descargarWord} disabled={ocupado !== null} icono={<Download size={14} />}>
            {ocupado === "word" ? "Generando Word..." : "Descargar Word"}
          </Button>
          <Button variant="primary" onClick={descargarPdf} disabled={ocupado !== null} icono={<Download size={14} />}>
            {ocupado === "pdf" ? "Generando PDF..." : "Descargar PDF"}
          </Button>
          <Button variant="secondary" onClick={imprimir} disabled={ocupado !== null} icono={<Printer size={14} />}>
            Imprimir
          </Button>
        </div>
        <p className="flex items-start gap-1.5 text-[10px] text-hint mt-1.5">
          <Pencil size={11} className="mt-px shrink-0" />
          Haz clic sobre cualquier texto de la hoja para editarlo; los cambios se reflejan en el Word, el PDF y la
          impresión. Nada se guarda en el servidor.
        </p>
        {desborda && (
          <p className="flex items-center gap-1.5 text-[11px] text-naranja mt-1">
            <TriangleAlert size={13} className="shrink-0" />
            El texto no cabe en una hoja A4 ni reduciendo la letra al mínimo. Acórtalo para que se imprima completo.
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
        <button onClick={onNuevo} className="inline-flex items-center gap-1.5 text-azul-osc text-[12px] font-semibold">
          <Plus size={14} />
          Nuevo trámite
        </button>
      </div>
    </>
  );
}

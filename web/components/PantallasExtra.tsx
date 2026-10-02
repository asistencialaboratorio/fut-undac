"use client";

import { useState } from "react";
import { CircleHelp, ClipboardList, ExternalLink, Save, Send, UserRound } from "lucide-react";
import { CATALOGO, listarTramites } from "@/lib/catalogo";
import { IconoTramite } from "./Iconos";
import { CAMPOS_CONFIG } from "@/lib/campos";
import { listarEscuelas, listarFacultades } from "@/lib/facultades";
import { borrarHistorial, borrarPerfil, cargarHistorial, cargarPerfil, CAMPOS_PERFIL, guardarPerfil, quitarDelHistorial, type EntradaHistorial } from "@/lib/almacen";
import type { FutData } from "@/lib/constructor";
import Button from "./Button";
import Campo from "./Campo";
import SectionHeader from "./SectionHeader";

export const URL_MESA_DE_PARTES = "https://digital.undac.edu.pe/mpv/inicio.do";

// ── Mis trámites (historial en este navegador) ──────────────────
export function PantallaMisTramites({ onAbrir, onNuevo }: { onAbrir: (fut: FutData) => void; onNuevo: () => void }) {
  const [entradas, setEntradas] = useState<EntradaHistorial[]>(() => cargarHistorial());

  return (
    <>
      <SectionHeader
        titulo="Mis trámites"
        icono={<ClipboardList size={18} strokeWidth={1.75} />}
        subtitulo="Los últimos FUT que generaste en este navegador"
        btnLabel="Nuevo trámite"
        onBtn={onNuevo}
      />
      <div className="px-6 py-5 max-w-3xl">
        <p className="text-[11px] text-suave mb-4">
          Se guardan solo en este navegador (no en un servidor) y se conservan hasta 20. Si borras los datos del
          navegador o usas otro equipo, no aparecerán.
        </p>
        {entradas.length === 0 ? (
          <div className="bg-bg-card border border-borde rounded-sm p-6 text-[12px] text-suave">
            Todavía no generaste ningún FUT. Cuando descargues o imprimas uno, aparecerá aquí para que lo vuelvas a abrir y
            editar.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {entradas.map((e) => (
              <div key={e.id} className="bg-bg-card border border-borde-card rounded-sm p-3 flex items-center gap-3 flex-wrap">
                <span className="w-9 h-9 flex items-center justify-center border border-borde rounded-sm text-azul-osc"><IconoTramite clave={e.fut.tramiteClave} /></span>
                <div className="flex-1 min-w-[180px]">
                  <div className="text-[12px] font-semibold text-titulo">{e.fut.tramiteNombre}</div>
                  <div className="text-[10px] text-suave">
                    {e.fut.nombresApellidos || "Sin nombre"} · {new Date(e.generado).toLocaleString("es-PE")}
                  </div>
                </div>
                <Button variant="primary" onClick={() => onAbrir(e.fut)}>
                  Abrir y editar
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    quitarDelHistorial(e.id);
                    setEntradas(cargarHistorial());
                  }}
                >
                  Quitar
                </Button>
              </div>
            ))}
            <button
              className="self-start text-rojo text-[11px] font-bold mt-2"
              onClick={() => {
                if (window.confirm("¿Borrar todo el historial de este navegador?")) {
                  borrarHistorial();
                  setEntradas([]);
                }
              }}
            >
              Borrar todo el historial
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Mis datos (perfil en este navegador) ────────────────────────
export function PantallaMisDatos({ onNuevo }: { onNuevo: () => void }) {
  const [datos, setDatos] = useState<Record<string, string>>(() => cargarPerfil());
  const [mensaje, setMensaje] = useState("");

  function cambiar(clave: string, valor: string) {
    setMensaje("");
    setDatos((d) => {
      const nuevo = { ...d, [clave]: valor };
      if (clave === "facultad") {
        const validas = listarEscuelas(valor);
        if (validas.length && !validas.includes(nuevo.escuela)) nuevo.escuela = "";
      }
      return nuevo;
    });
  }

  const campos = CAMPOS_CONFIG.filter((c) => (CAMPOS_PERFIL as readonly string[]).includes(c.clave));

  return (
    <>
      <SectionHeader
        titulo="Mis datos"
        icono={<UserRound size={18} strokeWidth={1.75} />}
        subtitulo="Guárdalos una vez y se completan solos en cada trámite"
        btnLabel="Nuevo trámite"
        onBtn={onNuevo}
      />
      <div className="px-6 py-5 max-w-3xl">
        <p className="text-[11px] text-suave mb-4">
          Se guardan solo en este navegador (no en un servidor). Puedes borrarlos cuando quieras.
        </p>
        <div className="bg-bg-card border border-borde rounded-sm p-5 space-y-4">
          {campos.map((campo) => (
            <Campo
              key={campo.clave}
              clave={campo.clave}
              etiqueta={campo.etiqueta}
              obligatorio={false}
              placeholder={campo.placeholder}
              ayuda={campo.ayuda}
              valor={datos[campo.clave] || ""}
              onChange={(v) => cambiar(campo.clave, v)}
              opciones={
                campo.clave === "facultad"
                  ? listarFacultades()
                  : campo.clave === "escuela"
                    ? listarEscuelas(datos.facultad)
                    : undefined
              }
            />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <Button
            variant="primary"
            icono={<Save size={14} />}
            onClick={() => setMensaje(guardarPerfil(datos) ? "Datos guardados en este navegador." : "No se pudo guardar (¿navegación privada?).")}
          >
            Guardar mis datos
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              borrarPerfil();
              setDatos({});
              setMensaje("Datos borrados de este navegador.");
            }}
          >
            Borrar mis datos
          </Button>
          {mensaje && <span className="text-[11px] text-suave">{mensaje}</span>}
        </div>
      </div>
    </>
  );
}

// ── Ayuda y contacto ────────────────────────────────────────────
function destinatarioLegible(plantilla: string) {
  return plantilla
    .replace("de la {facultad_completa}", "de tu facultad")
    .replace("{escuela}", "tu escuela")
    .replace(/\{[^}]+\}/g, "…");
}

export function PantallaAyuda({ onNuevo }: { onNuevo: () => void }) {
  const tramites = listarTramites();
  const [clave, setClave] = useState(tramites[0]?.clave ?? "");
  const t = CATALOGO[clave];

  return (
    <>
      <SectionHeader
        titulo="Ayuda y contacto"
        subtitulo="Cómo funciona y dónde presentar tu FUT"
        icono={<CircleHelp size={18} strokeWidth={1.75} />}
        btnLabel="Nuevo trámite"
        onBtn={onNuevo}
      />
      <div className="px-6 py-5 max-w-3xl space-y-5">
        <div className="bg-bg-card border border-borde rounded-sm p-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-titulo mb-1"><Send size={14} strokeWidth={1.75} className="text-azul-osc" />Mesa de partes virtual de la UNDAC</div>
          <p className="text-[11px] text-suave mb-3">
            Cuando tengas tu FUT listo (en PDF), preséntalo por la mesa de partes virtual de la universidad.
          </p>
          <a
            href={URL_MESA_DE_PARTES}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-semibold text-[12px] px-[16px] py-[8px] rounded-sm bg-azul-osc hover:bg-sb-bg text-white"
          >
            Ir a la mesa de partes virtual
            <ExternalLink size={14} />
          </a>
        </div>

        <div className="bg-bg-card border border-borde rounded-sm p-4">
          <div className="text-[12px] font-semibold text-titulo mb-2">¿Cómo funciona?</div>
          <ol className="list-decimal pl-5 text-[11px] text-cuerpo space-y-1">
            <li>Elige el trámite (o descríbelo y el sistema te sugiere uno).</li>
            <li>Completa tus datos; con tu código de matrícula se autocompletan casi todos.</li>
            <li>Revisa la fundamentación, que se redacta sola y puedes editar.</li>
            <li>En la vista previa edita lo que necesites y descarga Word o PDF, o imprime.</li>
            <li>Presenta el PDF con los documentos anexos en la mesa de partes virtual.</li>
          </ol>
        </div>

        <div className="bg-bg-card border border-borde rounded-sm p-4">
          <div className="text-[12px] font-semibold text-titulo mb-2">Guía por trámite</div>
          <select
            className="w-full border border-borde rounded px-2.5 py-2 text-[12px] bg-bg-card mb-3"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          >
            {tramites.map((x) => (
              <option key={x.clave} value={x.clave}>
                {x.nombre}
              </option>
            ))}
          </select>
          {t && (
            <dl className="text-[11px] text-cuerpo space-y-2">
              <div>
                <dt className="font-semibold text-titulo">Para qué sirve</dt>
                <dd>{t.ayuda}</dd>
              </div>
              <div>
                <dt className="font-semibold text-titulo">Documentos que sueles adjuntar</dt>
                <dd>{t.anexoSugerido || "Ninguno en particular."}</dd>
              </div>
              <div>
                <dt className="font-semibold text-titulo">Se dirige a</dt>
                <dd>{destinatarioLegible(t.destinatario)}</dd>
              </div>
            </dl>
          )}
        </div>

        <p className="text-[10px] text-hint">
          Esta herramienta no guarda tus datos en ningún servidor. Lo que ves en &quot;Mis datos&quot; y &quot;Mis trámites&quot;
          queda solo en este navegador.
        </p>
      </div>
    </>
  );
}
